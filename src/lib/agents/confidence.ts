import { withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { persistCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export type RunConfidenceInput = {
  jobId: string;
  recruiterId?: string;
};

export type RunConfidenceResult = {
  jobId: string;
  recomputed: Array<{
    candidateId: string;
    confidence: number;
  }>;
};

export async function runConfidence({
  jobId,
  recruiterId,
}: RunConfidenceInput): Promise<RunConfidenceResult> {
  const tenantId = await getCurrentTenantId();

  const [result] = await withAgentRun<RunConfidenceResult>(
    {
      agentName: AGENT_KILL_SWITCHES.MATCHER,
      recruiterId,
      inputSnapshot: { jobId },
      sourceType: "agent",
      sourceTag: "confidence",
    },
    async () => {
      const jobReq = await prisma.jobReq.findUnique({
        where: { id: jobId, tenantId },
        include: {
          matchResults: {
            include: {
              candidate: {
                include: {
                  skills: {
                    select: {
                      id: true,
                      name: true,
                      proficiency: true,
                      yearsOfExperience: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!jobReq) {
        throw new Error(`Job ${jobId} not found`);
      }

      const recomputed: RunConfidenceResult["recomputed"] = [];

      for (const match of jobReq.matchResults) {
        const confidence = await persistCandidateConfidenceScore({
          candidateId: match.candidateId,
          candidate: match.candidate,
        });

        recomputed.push({ candidateId: match.candidateId, confidence: confidence.score });
      }

      return { result: { jobId, recomputed } };
    },
  );

  return result;
}
