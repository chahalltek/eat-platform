import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/user";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { prisma, ApprovalStatus } from "@/server/db";
import { runApprovedActionWorkflow } from "@/server/workflows/runApprovedActionWorkflow";

const decisionSchema = z.object({
  decisionReason: z.string().trim().optional(),
});

type DecisionStatus = Extract<ApprovalStatus, "APPROVED" | "REJECTED">;

export async function handleApprovalDecision(
  req: NextRequest,
  params: Promise<{ id: string }>,
  status: DecisionStatus,
) {
  const user = await getCurrentUser(req);

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const approvalId = id?.trim();

  if (!approvalId) {
    return NextResponse.json({ error: "Invalid approval id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
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

  if (approval.status !== ApprovalStatus.PENDING) {
    return NextResponse.json({ error: "Approval is not pending" }, { status: 409 });
  }

  const decisionReason = parsed.data.decisionReason?.trim() || null;

  const updatedApproval = await prisma.agentActionApproval.update({
    where: { id: approvalId },
    data: {
      status,
      decidedBy: user.id,
      decidedAt: new Date(),
      decisionReason,
    },
  });

  if (updatedApproval.status !== ApprovalStatus.APPROVED) {
    return NextResponse.json({ approval: updatedApproval });
  }

  try {
    const workflowResult = await runApprovedActionWorkflow(updatedApproval);

    return NextResponse.json(workflowResult);
  } catch (error) {
    console.error("[approvals] Failed to run approved action workflow", error);
    return NextResponse.json(
      { error: "Approval updated but workflow failed", approval: updatedApproval },
      { status: 500 },
    );
  }
}
