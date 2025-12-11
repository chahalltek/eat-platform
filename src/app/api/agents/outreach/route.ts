// src/app/api/agents/outreach/route.ts
import { NextRequest, NextResponse } from "next/server";

import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from "@/lib/agents/killSwitch";
import { runOutreach } from "@/lib/agents/outreach";
import { getCurrentUser } from "@/lib/auth/user";
import { agentFeatureGuard } from "@/lib/featureFlags/middleware";
import { toRateLimitResponse } from "@/lib/rateLimiting/http";
import { isRateLimitError } from "@/lib/rateLimiting/rateLimiter";
import { validateRecruiterId } from "../recruiterValidation";
import { getCurrentTenantId } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  let body: unknown;

  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flagCheck = await agentFeatureGuard();

  if (flagCheck) {
    return flagCheck;
  }

  const tenantId = await getCurrentTenantId(req);
  const killSwitchResponse = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.OUTREACH, tenantId);

  if (killSwitchResponse) {
    return killSwitchResponse;
  }

  try {
    body = await req.json();
  } catch (err) {
    console.error("OUTREACH API invalid JSON:", err);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { recruiterId, candidateId, jobReqId } = (body ?? {}) as {
      recruiterId?: unknown;
      candidateId?: unknown;
      jobReqId?: unknown;
    };

    const recruiterValidation = await validateRecruiterId(
      typeof recruiterId === "string" && recruiterId.trim()
        ? recruiterId.trim()
        : currentUser.id,
      { required: true },
    );

    if ("error" in recruiterValidation) {
      return NextResponse.json(
        { error: recruiterValidation.error },
        { status: recruiterValidation.status },
      );
    }

    const trimmedCandidateId = typeof candidateId === "string" ? candidateId.trim() : "";
    const trimmedJobReqId = typeof jobReqId === "string" ? jobReqId.trim() : "";

    if (!trimmedCandidateId) {
      return NextResponse.json(
        { error: "candidateId is required and must be a string" },
        { status: 400 },
      );
    }

    if (!trimmedJobReqId) {
      return NextResponse.json(
        { error: "jobReqId is required and must be a string" },
        { status: 400 },
      );
    }

    console.log("OUTREACH API request:", {
      recruiterId: recruiterValidation.recruiterId,
      candidateId: trimmedCandidateId,
      jobReqId: trimmedJobReqId,
    });

    const validatedRecruiterId = recruiterValidation.recruiterId;
    const recruiterIdForOutreach = validatedRecruiterId ?? undefined;

    const result = await runOutreach({
      recruiterId: recruiterIdForOutreach,
      candidateId: trimmedCandidateId,
      jobReqId: trimmedJobReqId,
    });

    console.log("OUTREACH API success:", {
      agentRunId: result.agentRunId,
      recruiterId: validatedRecruiterId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("OUTREACH API error:", err);

    const message = err instanceof Error ? err.message : "Unknown error";
    const normalizedMessage = message.toLowerCase();

    if (isRateLimitError(err)) {
      return toRateLimitResponse(err);
    }

    if (normalizedMessage.includes("llm")) {
      return NextResponse.json(
        { error: "Outreach agent temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }

    if (normalizedMessage.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
