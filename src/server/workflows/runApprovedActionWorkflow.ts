import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { recordMetricEvent } from "@/lib/metrics/events";
import { executeApprovedAction } from "@/server/actions/executeApprovedAction";
import { validateApprovalRequest } from "@/server/approvals/approvalRequest";
import {
  ApprovalStatus,
  ExecutionStatus,
  HiringManagerBriefStatus,
  prisma,
  type AgentActionApproval,
  type ApprovalRequest,
} from "@/server/db/prisma";
import { generateHiringManagerBrief } from "@/server/hiringManagerBrief";

export type ApprovedActionWorkflowResult = {
  approval: AgentActionApproval;
  executionOutcome: {
    status: ExecutionStatus;
    message?: string;
  };
  hiringManagerBriefId?: string;
  hiringManagerBriefStatus?: HiringManagerBriefStatus;
};

async function logDecisionStreamItem(
  approval: AgentActionApproval,
  stage: string,
  details?: Record<string, unknown>,
) {
  await recordMetricEvent({
    tenantId: approval.tenantId ?? DEFAULT_TENANT_ID,
    eventType: "DECISION_STREAM_ITEM",
    entityId: approval.decisionStreamId ?? approval.jobReqId ?? approval.id,
    meta: {
      stage,
      approvalId: approval.id,
      actionType: approval.actionType,
      jobReqId: approval.jobReqId,
      candidateId: approval.candidateId,
      ...details,
    },
  });
}

type ActionApprovalWithRequest = AgentActionApproval & {
  approvalRequest?: ApprovalRequest | null;
};

async function resolveApprovalRequest(approval: ActionApprovalWithRequest) {
  if (approval.approvalRequest) return approval.approvalRequest;

  return prisma.approvalRequest.findUnique({
    where: { id: approval.approvalRequestId ?? approval.id },
  });
}

export async function runApprovedActionWorkflow(
  approval: ActionApprovalWithRequest,
): Promise<ApprovedActionWorkflowResult> {
  if (approval.status !== ApprovalStatus.APPROVED) {
    throw new Error("Approval must be in APPROVED status to execute workflow");
  }

  const approvalRequest = await resolveApprovalRequest(approval);
  const validator = await validateApprovalRequest({
    approvalRequest,
    actorId: approval.decidedBy ?? approval.proposedBy,
    tenantId: approval.tenantId ?? DEFAULT_TENANT_ID,
    actionType: approval.actionType,
    actionPayload: approval.actionPayload,
  });

  if (!validator.ok) {
    throw new Error(validator.message);
  }

  await logDecisionStreamItem(approval, "APPROVAL_DECIDED", {
    decidedBy: approval.decidedBy,
    decidedAt: approval.decidedAt,
  });

  const execution = await executeApprovedAction(approval);
  const executionStatus: ExecutionStatus =
    execution.outcome === "success" ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED;

  const updatedApproval = await prisma.agentActionApproval.update({
    where: { id: approval.id },
    data: {
      executionStatus,
      executionResult: execution,
      executedAt: new Date(),
    },
  });

  await logDecisionStreamItem(updatedApproval, "ACTION_EXECUTED", {
    outcome: execution.outcome,
    message: execution.message,
  });

  let briefId: string | undefined;
  let briefStatus: HiringManagerBriefStatus | undefined;

  if (executionStatus === ExecutionStatus.SUCCESS && approval.jobReqId) {
    const brief = await generateHiringManagerBrief({
      jobId: approval.jobReqId,
      recruiterId: approval.decidedBy ?? approval.proposedBy,
      sourceType: "APPROVED_ACTION_WORKFLOW",
      sourceTag: approval.id,
    });

    const readyBrief = await prisma.hiringManagerBrief.update({
      where: { id: brief.briefId },
      data: { status: HiringManagerBriefStatus.READY },
    });

    briefId = readyBrief.id;
    briefStatus = readyBrief.status as HiringManagerBriefStatus;

    await logDecisionStreamItem(updatedApproval, "HM_BRIEF_READY", {
      briefId,
      status: briefStatus,
    });
  }

  return {
    approval: updatedApproval,
    executionOutcome: {
      status: executionStatus,
      message: execution.message,
    },
    hiringManagerBriefId: briefId,
    hiringManagerBriefStatus: briefStatus,
  };
}
