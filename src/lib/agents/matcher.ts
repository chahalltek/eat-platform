<<<<<<< ours
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
=======
import { MatchResult } from "@prisma/client";

import { withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { matchJobToAllCandidates } from "@/lib/matching/batch";

export const MATCHER_AGENT_NAME = AGENT_KILL_SWITCHES.MATCHER;

export async function generateMatchExplanation(match: MatchResult): Promise<MatchResult> {
  // Placeholder for LLM-backed enrichment; kept simple for determinism in tests
  return match;
}

type MatcherAgentInput = {
  jobReqId: string;
  recruiterId?: string;
  limit?: number;
};

type MatcherAgentResult = { matches: MatchResult[] };
type MatcherAgentDependencies = { explainMatch?: typeof generateMatchExplanation };

export async function runMatcherAgent({
  jobReqId,
  recruiterId,
  limit = 200,
}: MatcherAgentInput, deps: MatcherAgentDependencies = {}): Promise<[MatcherAgentResult, string]> {
  const explainMatch = deps.explainMatch ?? generateMatchExplanation;

  return withAgentRun<MatcherAgentResult>(
    {
      agentName: MATCHER_AGENT_NAME,
      recruiterId,
      inputSnapshot: { jobReqId, limit },
      sourceType: "agent",
      sourceTag: "matcher",
    },
    async () => {
      const matches = await matchJobToAllCandidates(jobReqId, limit);
      const enrichedMatches = await Promise.all(matches.map((match) => explainMatch(match)));

      const sortedMatches = [...enrichedMatches].sort((a, b) => b.score - a.score);

      return { result: { matches: sortedMatches } };
    },
  );
>>>>>>> theirs
}
