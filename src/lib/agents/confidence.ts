import type { NextRequest } from "next/server";

import { withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { runConfidenceAgent } from "@/lib/agents/confidenceEngine";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export type RunConfidenceInput = {
  jobId: string;
  recruiterId?: string;
};

export type RunConfidenceResult = {
  jobId: string;
  results: Array<{
    candidateId: string;
    score: number;
    confidenceBand: "HIGH" | "MEDIUM" | "LOW";
    confidenceReasons: string[];
  }>;
};

export async function runConfidence({
  jobId,
  recruiterId,
}: RunConfidenceInput, req?: NextRequest): Promise<RunConfidenceResult> {
  const tenantId = await getCurrentTenantId(req);

  const [result] = await withAgentRun<RunConfidenceResult>(
    {
      agentName: AGENT_KILL_SWITCHES.MATCHER,
      recruiterId,
      inputSnapshot: { jobId },
      sourceType: "agent",
      sourceTag: "confidence",
    },
    async () => {
      const matches = await prisma.matchResult.findMany({
        where: { jobReqId: jobId, tenantId },
        select: {
          candidateId: true,
          score: true,
          candidateSignalBreakdown: true,
        },
      });

      const matchResults = matches.map((match) => {
        const breakdown = (match.candidateSignalBreakdown as
          | { confidence?: { reasons?: string[] } }
          | null
          | undefined) ?? { confidence: {} };

        const notes = Array.isArray(breakdown.confidence?.reasons)
          ? breakdown.confidence?.reasons
          : [];

        return {
          candidateId: match.candidateId,
          score: match.score,
          signals: notes.length ? { notes } : undefined,
        };
      });

      const confidence = await runConfidenceAgent({
        matchResults,
        job: { id: jobId },
        tenantId,
      });

      return { result: confidence };
    },
  );

  return result;
}
