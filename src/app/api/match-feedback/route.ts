import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/user";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { prisma } from "@/lib/prisma";

const feedbackSchema = z.object({
  matchId: z.string().trim().min(1, "matchId is required"),
  direction: z.enum(["UP", "DOWN"]).optional(),
  outcome: z.enum(["INTERVIEWED", "HIRED"]).optional(),
});

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

  const { matchId, direction, outcome } = parsed.data;

  if (!direction && !outcome) {
    return NextResponse.json({ error: "Provide a feedback direction or outcome" }, { status: 400 });
  }

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

    const feedback = await prisma.matchFeedback.create({
      data: {
        tenantId,
        matchResultId: match.id,
        jobReqId: match.jobReqId,
        candidateId: match.candidateId,
        jobCandidateId: match.jobCandidateId,
        userId: user.id,
        direction,
        outcome,
        matchSignals: {
          score: match.score,
          skillScore: match.skillScore,
          seniorityScore: match.seniorityScore,
          locationScore: match.locationScore,
          candidateSignalScore: match.candidateSignalScore,
          candidateSignalBreakdown: match.candidateSignalBreakdown,
          shortlisted: match.shortlisted,
          shortlistReason: match.shortlistReason,
        },
        guardrailsPreset: guardrailsConfig.preset ?? "balanced",
        systemMode: mode.mode,
      },
    });

    return NextResponse.json({
      id: feedback.id,
      direction: feedback.direction,
      outcome: feedback.outcome,
      guardrailsPreset: feedback.guardrailsPreset,
      systemMode: feedback.systemMode,
    });
  } catch (error) {
    console.error("Failed to record match feedback", error);
    return NextResponse.json({ error: "Unable to record feedback" }, { status: 500 });
  }
}
