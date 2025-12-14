import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
<<<<<<< ours
import { normalizeRole, USER_ROLES, isAdminRole } from "@/lib/auth/roles";
=======
import { isAdminRole, normalizeRole, USER_ROLES } from "@/lib/auth/roles";
>>>>>>> theirs
import { getCurrentUser } from "@/lib/auth/user";
import { ActionType, ApprovalStatus, prisma } from "@/server/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function parseStatusParam(statusParam: string | null): ApprovalStatus {
  if (!statusParam) {
    return ApprovalStatus.PENDING;
  }

  const normalized = statusParam.trim().toUpperCase();
  const match = (Object.values(ApprovalStatus) as string[]).find(
    (value) => value === normalized,
  );

  if (!match) {
    throw new Error("Invalid status parameter");
  }

  return match as ApprovalStatus;
<<<<<<< ours
=======
}

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
>>>>>>> theirs
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedTenantId = searchParams.get("tenantId")?.trim();
  const role = normalizeRole(user.role);
  const isPlatformAdmin = role === USER_ROLES.SYSTEM_ADMIN;
  const tenantId =
    (isPlatformAdmin ? requestedTenantId : user.tenantId) ?? DEFAULT_TENANT_ID;

  if (!isPlatformAdmin && user.tenantId && requestedTenantId && tenantId !== requestedTenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let status: ApprovalStatus;
  try {
    status = parseStatusParam(searchParams.get("status"));
  } catch (error) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const jobReqId = searchParams.get("jobReqId")?.trim();
  const candidateId = searchParams.get("candidateId")?.trim();

  const approvals = await prisma.agentActionApproval.findMany({
    where: {
      tenantId,
      status,
      ...(jobReqId ? { jobReqId } : {}),
      ...(candidateId ? { candidateId } : {}),
    },
    orderBy: { proposedAt: "desc" },
  });

  const serialized = approvals.map((approval) => ({
    ...approval,
    proposedAt: approval.proposedAt.toISOString(),
    decidedAt: approval.decidedAt ? approval.decidedAt.toISOString() : null,
    expiresAt: approval.expiresAt ? approval.expiresAt.toISOString() : null,
    executedAt: approval.executedAt ? approval.executedAt.toISOString() : null,
  }));

  return NextResponse.json({ approvals: serialized }, { status: 200 });
<<<<<<< ours
}

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

  const platformAdmin = isAdminRole(user.role);

  if (!platformAdmin) {
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
=======
>>>>>>> theirs
}
