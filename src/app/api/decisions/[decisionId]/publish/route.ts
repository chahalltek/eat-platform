import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { canPublishDecision } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getDecisionById, publishDecisionDraft, toDecisionDto } from "@/server/decision/decisionDrafts";
import { DecisionStatus } from "@/server/db/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { decisionId: string } },
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decisionId = params.decisionId?.trim();
  if (!decisionId) {
    return NextResponse.json({ error: "decisionId is required" }, { status: 400 });
  }

  const decision = await getDecisionById(decisionId);
  if (!decision) {
    return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  }

  const tenantId = decision.tenantId ?? DEFAULT_TENANT_ID;
  if (!canPublishDecision(user, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const published =
      decision.status === DecisionStatus.PUBLISHED ? decision : await publishDecisionDraft(decisionId, user.id);

    if (!published) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    return NextResponse.json({ decision: toDecisionDto(published) });
  } catch (error) {
    console.error("Failed to publish decision", error);
    return NextResponse.json({ error: "Unable to publish decision" }, { status: 500 });
  }
}
