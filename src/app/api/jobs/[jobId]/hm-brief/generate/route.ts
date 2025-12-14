import { NextRequest, NextResponse } from "next/server";

import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { generateHiringManagerBrief } from "@/server/hiringManagerBrief";

type RouteContext =
  | { params: { jobId: string } }
  | { params: Promise<{ jobId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let tenantScope;

  try {
    tenantScope = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return tenantError;
    }

    throw error;
  }

  const { prisma, tenantId } = tenantScope;

  if (!isAdminRole(roleCheck.user.role)) {
    const membership = await prisma.tenantUser.findUnique({
      where: { userId_tenantId: { userId: roleCheck.user.id, tenantId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { jobId } = await Promise.resolve(context.params);
  const jobReqId = jobId;

  const job = await prisma.jobReq.findUnique({ where: { id: jobReqId, tenantId } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const result = await generateHiringManagerBrief({
    jobId: job.id,
    recruiterId: roleCheck.user.id,
  });

  return NextResponse.json(result, { status: 201 });
}
