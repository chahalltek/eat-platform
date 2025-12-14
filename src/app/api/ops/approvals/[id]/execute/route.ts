import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { ApprovalStatus, ExecutionStatus, prisma } from "@/server/db";
import { executeApprovedAction } from "@/server/ops/executeApprovedAction";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const approvalId = id?.trim();

  if (!approvalId) {
    return NextResponse.json({ error: "Invalid approval id" }, { status: 400 });
  }

  const approval = await prisma.agentActionApproval.findUnique({ where: { id: approvalId } });

  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  const roleHint = getTenantRoleFromHeaders(req.headers);
  const access = await resolveTenantAdminAccess(user, approval.tenantId, { roleHint });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (approval.status !== ApprovalStatus.APPROVED) {
    return NextResponse.json({ error: "Approval is not approved" }, { status: 409 });
  }

  const execution = await executeApprovedAction(approval);

  const updatedApproval = await prisma.agentActionApproval.update({
    where: { id: approvalId },
    data: {
      executionStatus: execution.status,
      executionResult: execution.result,
      executedAt: new Date(),
    },
  });

  if (execution.status === ExecutionStatus.FAILED) {
    return NextResponse.json(
      { error: "Failed to execute approval", approval: updatedApproval },
      { status: 500 },
    );
  }

  return NextResponse.json({ approval: updatedApproval });
}
