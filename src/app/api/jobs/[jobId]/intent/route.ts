import { NextRequest, NextResponse } from "next/server";

import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let scopedTenant;

  try {
    scopedTenant = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return tenantError;
    }

    throw error;
  }

  const { prisma, tenantId } = scopedTenant;
  const { jobId } = await params;

  const jobIntent = await prisma.jobIntent.findFirst({
    where: { jobReqId: jobId, tenantId },
  });

  if (!jobIntent) {
    return NextResponse.json({ error: "JobIntent not found" }, { status: 404 });
  }

  return NextResponse.json(jobIntent, { status: 200 });
}
