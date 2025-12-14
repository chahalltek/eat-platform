import { NextRequest, NextResponse } from "next/server";

import { suggestionOnlyResponse } from "@/lib/agents/executionContract";
import { getCurrentUser } from "@/lib/auth/user";
import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { ApprovalStatus, ExecutionStatus, prisma } from "@/server/db";
import { validateApprovalRequest } from "@/server/approvals/approvalRequest";
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

  const approval = await prisma.agentActionApproval.findUnique({
    where: { id: approvalId },
    include: { approvalRequest: true },
  });

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

  const validation = await validateApprovalRequest({
    approvalRequest: approval.approvalRequest,
    actorId: user.id,
    tenantId: approval.tenantId,
    actionType: approval.actionType,
    actionPayload: approval.actionPayload,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: validation.status });
  }

  const agentsEnabled = await isFeatureEnabled(FEATURE_FLAGS.AGENTS);

  if (!agentsEnabled) {
    return suggestionOnlyResponse("Execution disabled in suggestion-only mode", { status: 200 });
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
      { status: "REJECTED", error: "Failed to execute approval", approval: updatedApproval },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "EXECUTED", approval: updatedApproval });
}
