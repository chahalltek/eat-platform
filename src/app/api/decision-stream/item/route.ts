import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { canPublishDecision } from "@/lib/auth/permissions";
import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { recordMetricEvent } from "@/lib/metrics/events";

const payloadSchema = z.object({
  streamId: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  candidateId: z.string().trim().min(1),
  action: z.enum(["VIEWED", "SHORTLISTED", "REMOVED", "FAVORITED"]),
  label: z.string().trim().optional(),
  confidence: z.number().min(0).max(10).default(5),
  confidenceBand: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  outcome: z.string().trim().optional(),
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

  const tenantId = (roleCheck.user.tenantId ?? DEFAULT_TENANT_ID).trim();
  const confidenceScore = parsed.data.confidence ?? 5;

  if (!canPublishDecision(roleCheck.user, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await recordMetricEvent({
      tenantId,
      eventType: "DECISION_STREAM_ITEM",
      entityId: parsed.data.streamId,
      meta: {
        ...parsed.data,
        confidence: {
          score: confidenceScore,
          band: parsed.data.confidenceBand ?? null,
        },
        actorId: roleCheck.user.id,
        actorEmail: roleCheck.user.email,
        actorRole: roleCheck.user.role,
      },
    });
  } catch (error) {
    console.error("Failed to write decision stream item", error);
    return NextResponse.json({ error: "Unable to write decision item" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
