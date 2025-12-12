import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/user";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { getConfidenceBand } from "@/lib/agents/confidenceEngine";

const feedbackSchema = z.object({
  matchId: z.string().trim().min(1, "matchId is required"),
  direction: z.enum(["UP", "DOWN"]).optional(),
  outcome: z.enum(["SCREENED", "INTERVIEWED", "OFFERED", "HIRED", "REJECTED"]),
  source: z.enum(["RECRUITER", "HIRING_MANAGER"]).optional(),
});

type ConfidenceDetails = {
  score: number | null;
  category: string | null;
  reasons: string[];
};

type MatchReasons = {
  confidence?: { score?: number; category?: string; reasons?: unknown };
  guardrails?: unknown;
} | null;

<<<<<<< ours
function isInputJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (value === null) return true;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isInputJsonValue(entry));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((entry) => isInputJsonValue(entry));
  }

  return false;
=======
function sanitizeInputJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeInputJsonValue(entry)) as Prisma.InputJsonArray;
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce<Prisma.InputJsonObject>((acc, [key, entry]) => {
      acc[key] = sanitizeInputJsonValue(entry);
      return acc;
    }, {} as Prisma.InputJsonObject);
  }

  return null;
>>>>>>> theirs
}

function hashGuardrails(config: Prisma.InputJsonValue) {
  try {
    return createHash("sha256").update(JSON.stringify(config)).digest("hex");
  } catch (error) {
    console.error("Unable to hash guardrails config", error);
    return null;
  }
}

function parseMatchReasons(value: unknown): MatchReasons {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as MatchReasons;
}

function getConfidence(reasons: MatchReasons): ConfidenceDetails {
  const confidence = reasons?.confidence;
  const score = typeof confidence?.score === "number" ? confidence.score : null;
  const category = typeof confidence?.category === "string" ? confidence.category : null;
  const reasonsList = Array.isArray(confidence?.reasons)
    ? (confidence?.reasons?.filter((entry) => typeof entry === "string") as string[])
    : [];

  return { score, category, reasons: reasonsList } satisfies ConfidenceDetails;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback", details: parsed.error.flatten() }, { status: 400 });
  }

  const { matchId, direction, outcome, source } = parsed.data;

  try {
    const match = await prisma.matchResult.findUnique({
      where: { id: matchId },
      include: { jobCandidate: true },
    });

    if (!match) {
      return NextResponse.json({ error: "Match result not found" }, { status: 404 });
    }

    const tenantId = match.tenantId;
    const [guardrailsConfig, mode] = await Promise.all([
      loadTenantConfig(tenantId),
      loadTenantMode(tenantId),
    ]);

    if (mode.mode === "fire_drill") {
      return NextResponse.json(
        {
          suppressed: true,
          reason: "fire_drill",
          message: "Learning updates are paused while Fire Drill is active.",
        },
        { status: 202 },
      );
    }

    const reasons = parseMatchReasons(match.reasons);
    const confidence = getConfidence(reasons);
    const guardrailsFromMatch =
      reasons && isInputJsonValue(reasons.guardrails) ? reasons.guardrails : null;
    const guardrailsPreset = guardrailsConfig.preset ?? "balanced";
    const guardrailsConfigSnapshot = (guardrailsFromMatch ?? guardrailsConfig) as Prisma.InputJsonValue;
    const guardrailsConfigHash = hashGuardrails(guardrailsConfigSnapshot);
    const shortlistStrategy =
      ((guardrailsFromMatch as { strategy?: string } | null)?.strategy as string | undefined) ??
      ((guardrailsConfig.shortlist as { strategy?: string } | undefined)?.strategy ?? null);

    const confidenceBand = getConfidenceBand(confidence.score ?? 0, guardrailsConfig as never);
<<<<<<< ours
    const explanationSnapshot: Prisma.InputJsonValue | null = reasons
      ? {
          confidence:
            confidence.score !== null || confidence.category !== null || confidence.reasons.length
              ? {
                  score: confidence.score,
                  category: confidence.category,
                  reasons: confidence.reasons,
                }
              : null,
          guardrails: guardrailsFromMatch,
        }
      : isInputJsonValue(match.reasons)
        ? match.reasons
        : null;
=======
    const explanationSnapshot = sanitizeInputJsonValue(reasons ?? match.reasons ?? null);
>>>>>>> theirs

    const outcomeSource = source ?? (typeof user.role === "string" ? user.role.toUpperCase() : null);

    const recommendationConfidence = mode.mode === "pilot" ? "low" : "normal";

    const matchSignals: Prisma.InputJsonObject = {
      score: match.score,
      skillScore: match.skillScore,
      seniorityScore: match.seniorityScore,
      locationScore: match.locationScore,
      candidateSignalScore: match.candidateSignalScore,
      candidateSignalBreakdown: match.candidateSignalBreakdown,
      shortlisted: match.shortlisted,
      shortlistReason: match.shortlistReason,
      guardrailsConfig: guardrailsConfigSnapshot,
      guardrailsConfigHash,
      guardrailsPreset,
      shortlistStrategy,
      confidenceScore: confidence.score,
      confidenceCategory: confidence.category,
      confidenceBand,
      confidenceReasons: confidence.reasons,
      systemMode: mode.mode,
      explanationSnapshot,
      recommendationConfidence,
    };

    const feedback = await prisma.matchFeedback.upsert({
      where: {
        tenantId_matchResultId_outcome: { tenantId, matchResultId: match.id, outcome },
      },
      update: {
        direction,
        outcomeSource,
        matchSignals,
        matchScore: match.score,
        confidenceScore: confidence.score,
        shortlistStrategy,
        guardrailsPreset,
        guardrailsConfig: guardrailsConfigSnapshot,
        systemMode: mode.mode,
      },
      create: {
        tenantId,
        matchResultId: match.id,
        jobReqId: match.jobReqId,
        candidateId: match.candidateId,
        jobCandidateId: match.jobCandidateId,
        userId: user.id,
        direction,
        outcome,
        outcomeSource,
        matchSignals,
        matchScore: match.score,
        confidenceScore: confidence.score,
        shortlistStrategy,
        guardrailsPreset,
        guardrailsConfig: guardrailsConfigSnapshot,
        systemMode: mode.mode,
      },
    });

    return NextResponse.json({
      id: feedback.id,
      direction: feedback.direction,
      outcome: feedback.outcome,
      outcomeSource: feedback.outcomeSource,
      matchScore: feedback.matchScore,
      confidenceScore: feedback.confidenceScore,
      guardrailsPreset: feedback.guardrailsPreset,
      guardrailsConfig: feedback.guardrailsConfig,
      shortlistStrategy: feedback.shortlistStrategy,
      systemMode: feedback.systemMode,
      recommendationConfidence,
    });
  } catch (error) {
    console.error("Failed to record match feedback", error);
    return NextResponse.json({ error: "Unable to record feedback" }, { status: 500 });
  }
}
