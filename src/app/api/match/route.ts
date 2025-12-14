import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { KILL_SWITCHES } from "@/lib/killSwitch";
import { enforceKillSwitch } from "@/lib/killSwitch/middleware";
import { prisma } from "@/server/db";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { enforceFeatureFlag } from "@/lib/featureFlags/middleware";
import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { handleMatchAgentPost } from "@/app/api/agents/match/route";
import { assertFeatureEnabled, FeatureDisabledError, HARD_FEATURE_FLAGS } from "@/config/featureFlags";

const matchRequestSchema = z.object({
  jobReqId: z.string().trim().min(1, "jobReqId must be a non-empty string"),
  candidateId: z.string().trim().min(1, "candidateId must be a non-empty string"),
});

export async function POST(req: NextRequest) {
  const killSwitchResponse = enforceKillSwitch(KILL_SWITCHES.SCORERS, { componentName: "Scoring" });

  if (killSwitchResponse) {
    return killSwitchResponse;
  }

  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const currentUser = roleCheck.user;

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = matchRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    const issues = parsedBody.error.issues.map((issue) => issue.message).join("; ");
    console.warn("Match payload validation failed", { issues, body, userId: currentUser?.id });
    return NextResponse.json(
      { error: "jobReqId and candidateId must be non-empty strings" },
      { status: 400 },
    );
  }

  const { jobReqId, candidateId } = parsedBody.data;
  const tenantId = (currentUser.tenantId ?? DEFAULT_TENANT_ID).trim();

  try {
    assertFeatureEnabled(HARD_FEATURE_FLAGS.EXECUTION_ENABLED);
  } catch (error) {
    if (error instanceof FeatureDisabledError) {
      return NextResponse.json(
        {
          matches: [],
          jobReqId,
          agentRunId: null,
          suggestionOnly: true,
          reason: error.message,
        },
        { status: 200 },
      );
    }

    throw error;
  }

  const flagCheck = await enforceFeatureFlag(FEATURE_FLAGS.SCORING, {
    featureName: "Scoring",
  });

  if (flagCheck) {
    return flagCheck;
  }

  const agentResponse = await handleMatchAgentPost(
    req,
    { jobReqId, candidateIds: [candidateId], limit: 1 },
    { requireAllCandidates: true },
  );

  if (!agentResponse.ok) {
    return agentResponse;
  }

  const payload = (await agentResponse.json()) as {
    matches: Array<{
      matchResultId: string;
      candidateId: string;
      confidence: number;
      confidenceCategory: string;
      confidenceReasons: string[];
    }>;
  };

  const match = payload.matches.find((entry) => entry.candidateId === candidateId);

  if (!match) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const matchResult = await prisma.matchResult.findUnique({
    where: { id: match.matchResultId, tenantId },
  });

  if (!matchResult) {
    return NextResponse.json({ error: "Match result not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...matchResult,
    confidence: match.confidence,
    confidenceCategory: match.confidenceCategory,
    confidenceReasons: match.confidenceReasons,
  });
}
