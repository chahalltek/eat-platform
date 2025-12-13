import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { recordMetricEvent } from "@/lib/metrics/events";

const ACTION_MAP = {
  CANDIDATE_OPEN: "RECRUITER_BEHAVIOR_CANDIDATE_OPEN",
  EXPLANATION_EXPANDED: "RECRUITER_BEHAVIOR_EXPLANATION_EXPANDED",
  SHORTLIST_OVERRIDE: "RECRUITER_BEHAVIOR_SHORTLIST_OVERRIDE",
  DECISION_TIME: "RECRUITER_BEHAVIOR_DECISION_TIME",
} as const;

const payloadSchema = z.object({
  action: z.enum(["CANDIDATE_OPEN", "EXPLANATION_EXPANDED", "SHORTLIST_OVERRIDE", "DECISION_TIME"]),
  jobId: z.string().trim().optional(),
  matchId: z.string().trim().optional(),
  candidateId: z.string().trim().optional(),
  confidence: z.string().trim().optional(),
  durationMs: z.number().int().min(0).optional(),
  details: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { action, details, ...rest } = parsed.data;
  const eventType = ACTION_MAP[action];
  const tenantId = (roleCheck.user.tenantId ?? DEFAULT_TENANT_ID).trim();

  try {
    await recordMetricEvent({
      tenantId,
      eventType,
      entityId: rest.matchId ?? rest.candidateId ?? rest.jobId ?? null,
      meta: {
        ...rest,
        action,
        actorRole: roleCheck.user.role,
        details: details ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to record recruiter behavior", error);
    return NextResponse.json({ error: "Unable to record behavior" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
