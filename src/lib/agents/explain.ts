import { Prisma } from "@/server/db/prisma";

import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { FireDrillAgentDisabledError } from "@/lib/agents/availability";
import { createAgentRunLog } from "@/lib/agents/agentRunLog";
import type { ConfidenceResult } from "@/lib/agents/confidenceEngine.v2";
import { buildExplanation, type Explanation } from "@/lib/agents/explainEngine";
import type { MatchResult } from "@/lib/agents/matchEngine";
import { guardrailsPresets } from "@/lib/guardrails/presets";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/lib/auth";
<<<<<<< ours
import {
  DEFAULT_TRADEOFF_DECLARATION,
  formatTradeoffDeclaration,
  resolveTradeoffs,
  tradeoffDeclarationSchema,
} from "@/lib/matching/tradeoffs";
=======
import { extractArchetypeFromIntent } from "@/lib/jobIntent";
>>>>>>> theirs

export type RunExplainInput = {
  jobId: string;
  candidateIds?: string[];
  tenantId?: string;
};

export type RunExplainResult = {
  jobId: string;
  explanations: Array<{ candidateId: string; explanation: Explanation }>;
  agentRunId: string;
};

function normalizeSignals(source?: Record<string, unknown>): MatchResult["signals"] {
  const signals = source ?? {};

  return {
    mustHaveSkillsCoverage: Number(signals.mustHaveSkillsCoverage ?? 0.5),
    niceToHaveSkillsCoverage: Number(signals.niceToHaveSkillsCoverage ?? 0.5),
    experienceAlignment: Number(signals.experienceAlignment ?? 0.5),
    locationAlignment: Number(signals.locationAlignment ?? 0.5),
  } satisfies MatchResult["signals"];
}

function toConfidenceResult(source: unknown): ConfidenceResult {
  const data = (source ?? {}) as Record<string, unknown>;
  const score = typeof data.score === "number" ? data.score : 0;
  const rawBand = (data.band ?? data.category) as string | undefined;
  const band = rawBand === "HIGH" || rawBand === "MEDIUM" ? rawBand : "LOW";
  const reasons = Array.isArray(data.reasons) ? (data.reasons as string[]) : [];

  return { score, band, reasons, candidateId: String(data.candidateId ?? "unknown") };
}

export async function runExplainForJob(input: RunExplainInput): Promise<RunExplainResult> {
  const { jobId, candidateIds } = input;
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Current user is required to run explain agent");
  }

  const jobReq = await prisma.jobReq.findUnique({
    where: { id: jobId },
    include: { skills: true, jobIntent: true },
  });

  if (!jobReq) {
    throw new Error(`Job ${jobId} not found for EXPLAIN agent`);
  }

  const tenantId = input.tenantId ?? jobReq.tenantId;
  const availability = await getAgentAvailability(tenantId);

  if (!availability.isEnabled("EXPLAIN")) {
    throw new FireDrillAgentDisabledError("Explain agent is disabled in Fire Drill mode");
  }

  const guardrails = await loadTenantConfig(tenantId);
  const archetype = extractArchetypeFromIntent(jobReq.jobIntent?.intent);
  const guardrailsSnapshot = JSON.parse(JSON.stringify(guardrails)) as Prisma.InputJsonValue;
  const explainConfig: Prisma.InputJsonObject = {
    jobId,
    candidateIds,
    tenantId,
    guardrails: guardrailsSnapshot,
  };

  const agentRun = await createAgentRunLog(prisma, {
    agentName: "ETE-TS.EXPLAIN",
    input: explainConfig,
    inputSnapshot: explainConfig,
    sourceType: "api",
    sourceTag: "explain",
    status: "RUNNING",
    tenantId,
  });

  try {
    const matchResults = await prisma.matchResult.findMany({
      where: {
        jobReqId: jobId,
        tenantId,
        ...(candidateIds ? { candidateId: { in: candidateIds } } : {}),
      },
      include: {
        candidate: { include: { skills: true } },
      },
      orderBy: { score: "desc" },
    });

    const explanations: RunExplainResult["explanations"] = [];
    const guardrailConfig = guardrails ?? guardrailsPresets.conservative;
    const isFireDrill = availability.mode.mode === "fire_drill";

    for (const match of matchResults) {
      const breakdown = (match.candidateSignalBreakdown as Record<string, unknown> | null) ?? {};
      const signals = normalizeSignals((breakdown as { signals?: Record<string, unknown> }).signals);
      const confidence = toConfidenceResult((breakdown as { confidence?: unknown }).confidence);
      const tradeoffSelection = (() => {
        const tradeoffs = (match.reasons as { tradeoffs?: { selection?: unknown } } | null | undefined)?.tradeoffs?.selection;
        const parsed = tradeoffDeclarationSchema.safeParse(tradeoffs);
        return parsed.success ? parsed.data : null;
      })();

      const baseMatch: MatchResult = {
        candidateId: match.candidateId,
        score: Math.round(match.score ?? 0),
        signals,
      };

      const explanation = buildExplanation({
        job: {
          id: jobReq.id,
          location: jobReq.location,
          seniorityLevel: jobReq.seniorityLevel ?? undefined,
          minExperienceYears: null,
          maxExperienceYears: null,
          skills: jobReq.skills,
        },
        candidate: {
          id: match.candidate.id,
          location: match.candidate.location,
          totalExperienceYears: match.candidate.totalExperienceYears ?? null,
          seniorityLevel: match.candidate.seniorityLevel ?? undefined,
          skills: match.candidate.skills,
        },
        match: baseMatch,
        confidence,
        config: guardrailConfig,
        archetype,
      });

      const explanationWithTradeoffs = tradeoffSelection
        ? {
            ...explanation,
            summary: `${explanation.summary} (Tradeoffs: ${formatTradeoffDeclaration(
              resolveTradeoffs(DEFAULT_TRADEOFF_DECLARATION, tradeoffSelection),
            )})`,
          }
        : explanation;

      explanations.push({ candidateId: match.candidateId, explanation: explanationWithTradeoffs });
    }

    const output: Prisma.InputJsonObject = { snapshot: explanations };

    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: { status: "SUCCESS", output, outputSnapshot: output.snapshot ?? Prisma.JsonNull },
    });

    return { jobId, explanations, agentRunId: agentRun.id } satisfies RunExplainResult;
  } catch (err) {
    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        output: { snapshot: { error: (err as Error)?.message ?? "unknown error" } },
        outputSnapshot: { error: (err as Error)?.message ?? "unknown error" },
      },
    });
    throw err;
  }
}
