import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/user";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

    const reasons = parseMatchReasons(match.reasons);
    const confidence = getConfidence(reasons);
    const guardrailsFromMatch =
      reasons?.guardrails && typeof reasons.guardrails === "object" ? reasons.guardrails : null;
    const guardrailsPreset = guardrailsConfig.preset ?? "balanced";
    const guardrailsConfigSnapshot = (guardrailsFromMatch ?? guardrailsConfig) as Prisma.InputJsonValue;
    const shortlistStrategy =
      ((guardrailsFromMatch as { strategy?: string } | null)?.strategy as string | undefined) ??
      ((guardrailsConfig.shortlist as { strategy?: string } | undefined)?.strategy ?? null);

    const outcomeSource = source ?? (typeof user.role === "string" ? user.role.toUpperCase() : null);

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
      guardrailsPreset,
      shortlistStrategy,
      confidenceScore: confidence.score,
      confidenceCategory: confidence.category,
      confidenceReasons: confidence.reasons,
      systemMode: mode.mode,
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
    });
  } catch (error) {
    console.error("Failed to record match feedback", error);
    return NextResponse.json({ error: "Unable to record feedback" }, { status: 500 });
  }
}
