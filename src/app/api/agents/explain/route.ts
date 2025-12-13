import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@prisma/client";
import type { UsageEventType } from "@prisma/client";

import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { createAgentRunLog } from "@/lib/agents/agentRunLog";
import { buildExplanation, maybePolishExplanation, type Explanation } from "@/lib/agents/explainEngine";
import type { MatchResult } from "@/lib/agents/matchEngine";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";
import { guardrailsPresets } from "@/lib/guardrails/presets";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { callLLM } from "@/lib/llm";
import { recordUsageEvent } from "@/lib/usage/events";

const requestSchema = z
  .object({
    matchId: z.string().trim().min(1).optional(),
    candidateMatchId: z.string().trim().min(1).optional(),
    force: z.boolean().optional(),
  })
  .refine((value) => value.matchId || value.candidateMatchId, {
    message: "matchId or candidateMatchId is required",
  })
  .refine((value) => !(value.matchId && value.candidateMatchId), {
    message: "Provide either matchId or candidateMatchId, not both",
  });

const AGENT_NAME = "ETE-TS.EXPLAIN";

function normalizeSignals(source?: Record<string, unknown>): MatchResult["signals"] {
  const signals = source ?? {};

  return {
    mustHaveSkillsCoverage: Number(signals.mustHaveSkillsCoverage ?? 0.5),
    niceToHaveSkillsCoverage: Number(signals.niceToHaveSkillsCoverage ?? 0.5),
    experienceAlignment: Number(signals.experienceAlignment ?? 0.5),
    locationAlignment: Number(signals.locationAlignment ?? 0.5),
  } satisfies MatchResult["signals"];
}

function deriveConfidenceCategory(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

function toConfidenceBand(
  source: unknown,
  candidateId: string,
  fallbackScore?: number,
  fallbackReasons?: unknown,
): {
  candidateId: string;
  score: number;
  category: "HIGH" | "MEDIUM" | "LOW";
  band: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
} {
  const data = (source ?? {}) as Record<string, unknown>;
  const score = typeof data.score === "number" ? data.score : typeof fallbackScore === "number" ? fallbackScore : 0;
  const reasons = Array.isArray(data.reasons)
    ? (data.reasons as unknown[]).filter((reason): reason is string => typeof reason === "string")
    : Array.isArray(fallbackReasons)
      ? (fallbackReasons as unknown[]).filter((reason): reason is string => typeof reason === "string")
      : [];
  const category = data.category === "HIGH" || data.category === "MEDIUM"
    ? data.category
    : deriveConfidenceCategory(score);

  return { score, category, band: category, reasons, candidateId };
}

function toJobSkills(
  skills: Array<{ name: string; normalizedName?: string | null; required?: boolean | null }> | string[],
) {
  return skills.map((skill) =>
    typeof skill === "string"
      ? { name: skill, normalizedName: skill, required: true }
      : { name: skill.name, normalizedName: skill.normalizedName ?? undefined, required: Boolean(skill.required) },
  );
}

function toCandidateSkills(skills?: Array<{ name: string; normalizedName?: string | null }>) {
  return (skills ?? []).map((skill) => ({ name: skill.name, normalizedName: skill.normalizedName ?? undefined }));
}

function buildMinimalExplanation(mode: string): Explanation {
  return {
    summary: `Fire Drill mode (${mode}): EXPLAIN paused.`,
    strengths: [],
    risks: [],
  } satisfies Explanation;
}

type JobFingerprintInput = {
  id: string;
  location: string | null;
  seniorityLevel: string | null;
  skills: ReturnType<typeof toJobSkills>;
};

type CandidateFingerprintInput = {
  id: string;
  location: string | null;
  seniorityLevel: string | null;
  totalExperienceYears: number | null;
  skills: ReturnType<typeof toCandidateSkills>;
};

type ExplanationFingerprints = {
  mode: string;
  guardrails: string;
  job: string;
  candidate: string;
  match: string;
};

type PersistedExplanation = {
  version: 1;
  updatedAt: string;
  explanation: Explanation;
  fingerprints: ExplanationFingerprints;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

function buildFingerprints({
  mode,
  guardrails,
  job,
  candidate,
  match,
  confidence,
}: {
  mode: string;
  guardrails: Prisma.JsonValue;
  job: JobFingerprintInput;
  candidate: CandidateFingerprintInput;
  match: MatchResult;
  confidence: ReturnType<typeof toConfidenceBand>;
}): ExplanationFingerprints {
  const normalizedJob = {
    ...job,
    skills: [...job.skills].sort((a, b) => a.name.localeCompare(b.name)),
  };

  const normalizedCandidate = {
    ...candidate,
    skills: [...candidate.skills].sort((a, b) => a.name.localeCompare(b.name)),
  };

  return {
    mode,
    guardrails: stableStringify(guardrails),
    job: stableStringify(normalizedJob),
    candidate: stableStringify(normalizedCandidate),
    match: stableStringify({ ...match, confidence }),
  } satisfies ExplanationFingerprints;
}

function parsePersistedExplanation(raw: unknown): PersistedExplanation | null {
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return parsePersistedExplanation(JSON.parse(raw));
    } catch (err) {
      console.warn("Failed to parse persisted explanation string", err);
      return null;
    }
  }

  const data = raw as Record<string, unknown>;

  if (
    data.version === 1 &&
    data.explanation &&
    typeof data.updatedAt === "string" &&
    typeof data.fingerprints === "object"
  ) {
    return data as PersistedExplanation;
  }

  return null;
}

function isPersistedExplanationValid(
  persisted: PersistedExplanation | null,
  fingerprints: ExplanationFingerprints,
): persisted is PersistedExplanation {
  if (!persisted) return false;

  const current = persisted.fingerprints;

  return (
    current.mode === fingerprints.mode &&
    current.guardrails === fingerprints.guardrails &&
    current.job === fingerprints.job &&
    current.candidate === fingerprints.candidate &&
    current.match === fingerprints.match
  );
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 },
    );
  }

  let scopedTenant;
  try {
    scopedTenant = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return tenantError;
    }

    throw error;
  }

  const { prisma: scopedPrisma, tenantId, runWithTenantContext } = scopedTenant;
  const { matchId, candidateMatchId, force } = parsed.data;

  return runWithTenantContext(async () => {
    const match = matchId
      ? await scopedPrisma.match.findFirst({
          where: { id: matchId, tenantId },
          include: {
            jobReq: { include: { skills: true } },
            candidate: { include: { skills: true } },
          },
        })
      : await scopedPrisma.candidateMatch.findFirst({
          where: { id: candidateMatchId, tenantId },
          include: {
            job: true,
            candidate: { include: { skills: true } },
          },
        });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const availability = await getAgentAvailability(tenantId);
    const guardrails = (await loadTenantConfig(tenantId)) ?? guardrailsPresets.conservative;
    const guardrailsSnapshot = JSON.parse(JSON.stringify(guardrails ?? {})) as Prisma.JsonValue;
    const isFireDrill = availability.mode.mode === "fire_drill";

    const job = "jobReq" in match ? match.jobReq : match.job;
    const candidate = match.candidate;
    const breakdown = ("scoreBreakdown" in match ? match.scoreBreakdown : null) as
      | { signals?: Record<string, unknown>; confidence?: unknown }
      | null;
    const confidenceBand = toConfidenceBand(
      breakdown?.confidence,
      candidate.id,
      "confidence" in match && typeof match.confidence === "number" ? match.confidence : undefined,
      "confidenceReasons" in match ? (match.confidenceReasons as unknown) : undefined,
    );

    const jobContext = {
      id: job.id,
      location: job.location ?? null,
      seniorityLevel: "seniorityLevel" in job ? job.seniorityLevel ?? null : null,
      skills: toJobSkills("skills" in job ? job.skills : job.requiredSkills),
    } satisfies {
      id: string;
      location: string | null;
      seniorityLevel: string | null;
      skills: ReturnType<typeof toJobSkills>;
    };

    const candidateContext = {
      id: candidate.id,
      location: candidate.location ?? null,
      seniorityLevel: "seniorityLevel" in candidate ? candidate.seniorityLevel ?? null : null,
      totalExperienceYears: "totalExperienceYears" in candidate ? candidate.totalExperienceYears ?? null : null,
      skills: toCandidateSkills(candidate.skills as Array<{ name: string; normalizedName?: string | null }> | undefined),
    } satisfies {
      id: string;
      location: string | null;
      seniorityLevel: string | null;
      totalExperienceYears: number | null;
      skills: ReturnType<typeof toCandidateSkills>;
    };

    const matchResult: MatchResult = {
      candidateId: candidate.id,
      score: Math.round("overallScore" in match ? Number(match.overallScore ?? 0) : Number(match.matchScore ?? 0)),
      signals: normalizeSignals(breakdown?.signals ?? undefined),
    } satisfies MatchResult;

    if (!isFireDrill && !availability.isEnabled("EXPLAIN")) {
      return NextResponse.json({ error: "EXPLAIN agent disabled" }, { status: 403 });
    }

    const fingerprints = buildFingerprints({
      mode: availability.mode.mode,
      guardrails: guardrailsSnapshot,
      job: jobContext,
      candidate: candidateContext,
      match: matchResult,
      confidence: confidenceBand,
    });

    const persisted = parsePersistedExplanation(
      "jobReq" in match ? (match as { explanation?: unknown }).explanation : (match as { explanation?: unknown }).explanation,
    );

    const startedAt = new Date();
    const inputSnapshot: Prisma.JsonObject = {
      ...parsed.data,
      mode: availability.mode.mode,
      guardrails: guardrailsSnapshot,
      fingerprints,
    };
    const agentRun = await createAgentRunLog(scopedPrisma, {
      agentName: AGENT_NAME,
      tenantId,
      sourceType: "api",
      sourceTag: "agents/explain",
      input: parsed.data,
      inputSnapshot,
      status: "RUNNING",
      startedAt,
    });

    try {
      const usePersisted = !force && isPersistedExplanationValid(persisted, fingerprints);
      const baseExplanation =
        isFireDrill || usePersisted
          ? usePersisted
            ? persisted.explanation
            : buildMinimalExplanation(availability.mode.mode)
          : buildExplanation({
              job: {
                ...jobContext,
                minExperienceYears: null,
                maxExperienceYears: null,
              },
              candidate: candidateContext,
              match: matchResult,
              confidence: confidenceBand,
              config: guardrails,
            });

      const explanation =
        isFireDrill || usePersisted
          ? baseExplanation
          : await maybePolishExplanation(baseExplanation, {
              config: guardrails,
              fireDrill: isFireDrill,
              callLLMFn: ({ systemPrompt, userPrompt }) => callLLM({ systemPrompt, userPrompt, agent: "EXPLAIN" }),
            });

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const persistedPayload: PersistedExplanation = {
        version: 1,
        updatedAt: new Date().toISOString(),
        explanation,
        fingerprints,
      };

      if (!usePersisted) {
        if ("jobReq" in match) {
          await scopedPrisma.match.update({
            where: { id: match.id },
            data: { explanation: JSON.stringify(persistedPayload) },
          });
        } else {
          await scopedPrisma.candidateMatch.update({
            where: { id: match.id },
            data: { explanation: persistedPayload as Prisma.InputJsonValue },
          });
        }
      }

      const output: Prisma.InputJsonObject = { snapshot: explanation, cached: usePersisted };

      await scopedPrisma.agentRunLog.update({
        where: { id: agentRun.id },
        data: {
          status: "SUCCESS",
          output,
          outputSnapshot: output.snapshot ?? Prisma.JsonNull,
          finishedAt,
          durationMs,
        },
      });

      void recordUsageEvent({ tenantId, eventType: "EXPLAIN_CALL" as UsageEventType, metadata: { matchId: match.id } });

      return NextResponse.json(
        { candidateId: candidate.id, explanation, agentRunId: agentRun.id, mode: availability.mode.mode },
        { status: 200 },
      );
    } catch (error) {
      const finishedAt = new Date();
      await scopedPrisma.agentRunLog.update({
        where: { id: agentRun.id },
        data: {
          status: "FAILED",
          errorMessage: (error as Error)?.message ?? "Unknown error",
          output: { snapshot: { error: (error as Error)?.message ?? "Unknown error" } },
          outputSnapshot: { error: (error as Error)?.message ?? "Unknown error" },
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });

      console.error("Explain agent failed", error);
      return NextResponse.json({ error: "Failed to generate explanation" }, { status: 500 });
    }
  });
}
