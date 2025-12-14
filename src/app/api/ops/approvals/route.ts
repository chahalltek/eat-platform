import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma, ActionType, ApprovalStatus } from "@/server/db";

const payloadSchema = z
  .object({
    tenantId: z.string().trim().min(1),
    jobReqId: z.string().trim().min(1).optional(),
    candidateId: z.string().trim().min(1).optional(),
    actionType: z.nativeEnum(ActionType),
    actionPayload: z.any(),
    decisionStreamId: z.string().trim().min(1).optional(),
  })
  .refine(
    (payload) => Boolean(payload.jobReqId) || Boolean(payload.candidateId),
    {
      message: "jobReqId or candidateId is required",
      path: ["jobReqId"],
    },
  );

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tenantId, jobReqId, candidateId, actionType, actionPayload, decisionStreamId } = parsed.data;
  const normalizedTenantId = tenantId.trim();

  const isPlatformAdmin = isAdminRole(user.role);

  if (!isPlatformAdmin) {
    const membership = await prisma.tenantUser.findUnique({
      where: { userId_tenantId: { tenantId: normalizedTenantId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const approval = await prisma.agentActionApproval.create({
      data: {
        tenantId: normalizedTenantId,
        jobReqId: jobReqId?.trim(),
        candidateId: candidateId?.trim(),
        actionType,
        actionPayload,
        proposedBy: user.id,
        status: ApprovalStatus.PENDING,
        decisionStreamId: decisionStreamId?.trim(),
      },
    });

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    console.error("[ops/approvals] Failed to create approval", error);
    return NextResponse.json({ error: "Unable to create approval" }, { status: 500 });
  }
}
