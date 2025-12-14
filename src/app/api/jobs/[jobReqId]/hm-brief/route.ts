import { NextRequest, NextResponse } from "next/server";

import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";

type RouteContext =
  | { params: { jobReqId: string } }
  | { params: Promise<{ jobReqId: string }> };

async function ensureTenantMembership(
  req: NextRequest,
  context: RouteContext,
) {
  const user = await getCurrentUser(req);

  if (!user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  let tenantScope;

  try {
    tenantScope = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return { errorResponse: tenantError } as const;
    }

    throw error;
  }

  const { prisma, tenantId } = tenantScope;

  if (!isAdminRole(user.role)) {
    const membership = await prisma.tenantUser.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });

    if (!membership) {
      return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
    }
  }

  const { jobReqId } = await Promise.resolve(context.params);

  return { user, tenantScope, jobReqId } as const;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const membership = await ensureTenantMembership(req, context);

  if ("errorResponse" in membership) {
    return membership.errorResponse;
  }

  const { tenantScope, jobReqId } = membership;
  const { prisma, tenantId } = tenantScope;

  const brief = await prisma.hiringManagerBrief.findFirst({
    where: { jobReqId, tenantId },
    orderBy: { createdAt: "desc" },
  });

  if (!brief) {
    return NextResponse.json({ error: "Hiring manager brief not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      briefId: brief.id,
      jobId: brief.jobReqId,
      content: brief.content,
      status: brief.status,
      createdAt: brief.createdAt,
      updatedAt: brief.updatedAt,
      sentAt: brief.sentAt,
      sentTo: brief.sentTo,
    },
    { status: 200 },
  );
}
