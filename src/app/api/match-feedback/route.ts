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
  feedback: z.enum(["positive", "negative"]),
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
}

function sanitizeInputJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null) return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeInputJsonValue(entry)) as Prisma.InputJsonArray;
  }

  if (typeof value === "object") {
    const sanitizedEntries = Object.entries(value).map(([key, entry]) => [
      key,
      sanitizeInputJsonValue(entry),
    ]);

    return Object.fromEntries(sanitizedEntries) as Prisma.InputJsonObject;
  }

  return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
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

  const { matchId, feedback } = parsed.data;

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
    const explanationSnapshot = sanitizeInputJsonValue(
      reasons
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
        : match.reasons ?? null,
    );

    const outcome = "FEEDBACK";
    const outcomeSource = typeof user.role === "string" ? user.role.toUpperCase() : null;

    const recommendationConfidence = mode.mode === "pilot" ? "low" : "normal";

    const direction = feedback === "positive" ? "UP" : "DOWN";

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

    const feedbackEntry = await prisma.matchFeedback.upsert({
      where: {
        tenantId_jobReqId_candidateId_userId: {
          tenantId,
          jobReqId: match.jobReqId,
          candidateId: match.candidateId,
          userId: user.id,
        },
      },
      update: {
        matchResultId: match.id,
        direction,
        feedback,
        outcomeSource,
        matchSignals,
        matchScore: match.score,
        confidenceScore: confidence.score,
        shortlistStrategy,
        guardrailsPreset,
        guardrailsConfig: guardrailsConfigSnapshot,
        guardrailsConfigHash,
        systemMode: mode.mode,
        outcome,
      },
      create: {
        tenantId,
        matchResultId: match.id,
        jobReqId: match.jobReqId,
        candidateId: match.candidateId,
        jobCandidateId: match.jobCandidateId,
        userId: user.id,
        feedback,
        direction,
        outcome,
        outcomeSource,
        matchSignals,
        matchScore: match.score,
        confidenceScore: confidence.score,
        shortlistStrategy,
        guardrailsPreset,
        guardrailsConfig: guardrailsConfigSnapshot,
        guardrailsConfigHash,
        systemMode: mode.mode,
      },
    });

    return NextResponse.json({
      id: feedbackEntry.id,
      feedback: feedbackEntry.feedback,
      direction: feedbackEntry.direction,
      outcome: feedbackEntry.outcome,
      outcomeSource: feedbackEntry.outcomeSource,
      matchScore: feedbackEntry.matchScore,
      confidenceScore: feedbackEntry.confidenceScore,
      guardrailsPreset: feedbackEntry.guardrailsPreset,
      guardrailsConfig: feedbackEntry.guardrailsConfig,
      guardrailsConfigHash: feedbackEntry.guardrailsConfigHash,
      shortlistStrategy: feedbackEntry.shortlistStrategy,
      systemMode: feedbackEntry.systemMode,
      recommendationConfidence,
    });
  } catch (error) {
    console.error("Failed to record match feedback", error);
    return NextResponse.json({ error: "Unable to record feedback" }, { status: 500 });
  }
}
