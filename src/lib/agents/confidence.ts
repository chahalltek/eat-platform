import type { NextRequest } from "next/server";

import { withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { runConfidenceAgent } from "@/lib/agents/confidenceEngine";
import { prisma } from "@/server/db";
import { getCurrentTenantId } from "@/lib/tenant";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";

export type RunConfidenceInput = {
  jobId: string;
  recruiterId?: string;
};

export type RunConfidenceResult = {
  jobId: string;
  results: Array<{
    candidateId: string;
    score: number;
    confidenceScore: number;
    confidenceBand: "HIGH" | "MEDIUM" | "LOW";
    confidenceReasons: string[];
    riskFlags: { type: string; detail: string }[];
    recommendedAction: string;
  }>;
};

export async function runConfidence({
  jobId,
  recruiterId,
}: RunConfidenceInput, req?: NextRequest): Promise<RunConfidenceResult> {
  const tenantId = (await getCurrentTenantId(req)) ?? DEFAULT_TENANT_ID;

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
          | {
              confidence?: {
                reasons?: string[];
                mustHaveCoverage?: number;
                niceToHaveCoverage?: number;
                experienceAlignment?: number;
                engagement?: number;
                missingMustHaves?: string[];
              };
            }
          | null
          | undefined) ?? { confidence: {} };

        const notes = Array.isArray(breakdown.confidence?.reasons)
          ? breakdown.confidence?.reasons
          : [];

        const signals = (() => {
          const confidence = breakdown.confidence ?? {};

          const mustHaveCoverage =
            typeof confidence.mustHaveCoverage === "number" ? confidence.mustHaveCoverage : undefined;
          const niceToHaveCoverage =
            typeof confidence.niceToHaveCoverage === "number" ? confidence.niceToHaveCoverage : undefined;
          const experienceAlignment =
            typeof confidence.experienceAlignment === "number" ? confidence.experienceAlignment : undefined;
          const engagement = typeof confidence.engagement === "number" ? confidence.engagement : undefined;
          const missingMustHaves = Array.isArray(confidence.missingMustHaves)
            ? (confidence.missingMustHaves.filter((entry) => typeof entry === "string") as string[])
            : undefined;

          const hasSignals =
            notes.length ||
            mustHaveCoverage !== undefined ||
            niceToHaveCoverage !== undefined ||
            experienceAlignment !== undefined ||
            engagement !== undefined ||
            (missingMustHaves?.length ?? 0) > 0;

          if (!hasSignals) return undefined;

          const signals: NonNullable<Parameters<typeof runConfidenceAgent>[0]["matchResults"]>[number]["signals"] = {
            notes,
          };

          if (mustHaveCoverage !== undefined) signals.mustHaveCoverage = mustHaveCoverage;
          if (niceToHaveCoverage !== undefined) signals.niceToHaveCoverage = niceToHaveCoverage;
          if (experienceAlignment !== undefined) signals.experienceAlignment = experienceAlignment;
          if (engagement !== undefined) signals.engagement = engagement;
          if ((missingMustHaves?.length ?? 0) > 0) signals.missingMustHaves = missingMustHaves;

          return signals;
        })();

        return {
          candidateId: match.candidateId,
          score: match.score,
          signals,
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
