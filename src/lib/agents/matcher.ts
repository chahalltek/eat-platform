import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { computeMatchScore } from "@/lib/matching/msa";
import { prisma } from "@/lib/prisma";

export type RunMatcherInput = {
  recruiterId?: string;
  jobId: string;
  topN?: number;
};

export type RunMatcherResult = {
  jobId: string;
  matches: Array<{
    candidateId: string;
    matchScore: number;
    explanationId: string;
  }>;
  agentRunId: string;
};

export async function runMatcher(
  input: RunMatcherInput,
  retryMetadata?: AgentRetryMetadata,
): Promise<RunMatcherResult> {
  const { recruiterId, jobId } = input;
  const topN = input.topN ?? 10;

  const [result, agentRunId] = await withAgentRun<RunMatcherResult>(
    {
      agentName: "EAT-TS.MATCHER",
      recruiterId,
      inputSnapshot: { jobId, topN },
      ...retryMetadata,
    },
    async () => {
      const jobReq = await prisma.jobReq.findUnique({
        where: { id: jobId },
        include: { skills: true },
      });

      if (!jobReq) {
        throw new Error(`Job ${jobId} not found`);
      }

      const candidates = await prisma.candidate.findMany({
        where: { tenantId: jobReq.tenantId, deletedAt: null },
        include: { skills: true },
      });

      const scored = candidates.map((candidate) => ({
        candidate,
        breakdown: computeMatchScore({ candidate, jobReq }),
      }));

      const topMatches = scored
        .sort((a, b) => b.breakdown.score - a.breakdown.score)
        .slice(0, topN);

      const matches: RunMatcherResult["matches"] = [];

      for (const item of topMatches) {
        const matchResult = await prisma.matchResult.create({
          data: {
            candidateId: item.candidate.id,
            jobReqId: jobReq.id,
            score: item.breakdown.score,
            reasons: item.breakdown.explanation,
            skillScore: item.breakdown.skillScore,
            seniorityScore: item.breakdown.seniorityScore,
            locationScore: item.breakdown.locationScore,
            candidateSignalScore: item.breakdown.candidateSignalScore,
            candidateSignalBreakdown: item.breakdown.candidateSignalBreakdown,
            agentRunId,
          },
        });

        matches.push({
          candidateId: item.candidate.id,
          matchScore: item.breakdown.score,
          explanationId: matchResult.id,
        });
      }

      return {
        result: {
          jobId: jobReq.id,
          matches,
          agentRunId,
        },
        outputSnapshot: {
          jobId: jobReq.id,
          matchesCreated: matches.length,
          topN,
        },
      };
    },
  );

  return {
    ...result,
    agentRunId,
  };
}
