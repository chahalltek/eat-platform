import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { recordMetricEvent } from "@/lib/metrics/events";
import {
  ActionType,
  AgentActionApproval,
  JobCandidateStatus,
  prisma,
} from "@/server/db";

export type ExecutionOutcome = "success" | "failure" | "not_implemented";

export type ExecutionResult = {
  outcome: ExecutionOutcome;
  message?: string;
};

type PushCandidatesPayload = {
  jobCandidateId?: string;
  matchId?: string;
  note?: string;
  status?: JobCandidateStatus;
};

type PauseRequisitionPayload = {
  newStatus?: string;
};

async function logDecisionStreamOutcome(
  approval: AgentActionApproval,
  result: ExecutionResult,
  extraMeta?: Record<string, unknown>,
) {
  try {
    await recordMetricEvent({
      tenantId: approval.tenantId ?? DEFAULT_TENANT_ID,
      eventType: "DECISION_STREAM_ITEM",
      entityId: approval.decisionStreamId ?? approval.jobReqId ?? approval.id,
      meta: {
        approvalId: approval.id,
        actionType: approval.actionType,
        outcome: result.outcome,
        message: result.message ?? null,
        ...(extraMeta ?? {}),
      },
    });
  } catch (error) {
    console.warn("Failed to log decision stream outcome", error);
  }
}

async function upsertJobCandidateStatus(
  approval: AgentActionApproval,
  targetStatus: JobCandidateStatus,
): Promise<string | null> {
  const jobReqId = approval.jobReqId?.trim();
  const candidateId = approval.candidateId?.trim();

  if (!jobReqId || !candidateId) {
    return null;
  }

  const existing = await prisma.jobCandidate.findFirst({
    where: {
      tenantId: approval.tenantId,
      jobReqId,
      candidateId,
    },
  });

  if (existing) {
    if (existing.status !== targetStatus) {
      await prisma.jobCandidate.update({
        where: { id: existing.id },
        data: { status: targetStatus },
      });
    }

    return existing.id;
  }

  const created = await prisma.jobCandidate.create({
    data: {
      tenantId: approval.tenantId,
      jobReqId,
      candidateId,
      status: targetStatus,
    },
  });

  return created.id;
}

async function handlePushCandidates(
  approval: AgentActionApproval,
): Promise<ExecutionResult> {
  const payload = (approval.actionPayload ?? {}) as PushCandidatesPayload;
  const desiredStatus = payload.status ?? JobCandidateStatus.SUBMITTED;

  const jobCandidateId = await upsertJobCandidateStatus(approval, desiredStatus);

  if (!jobCandidateId) {
    return { outcome: "failure", message: "Missing job or candidate context" };
  }

  if (payload.note?.trim()) {
    await prisma.jobCandidateNote.create({
      data: {
        tenantId: approval.tenantId,
        jobCandidateId,
        authorId: approval.proposedBy,
        content: payload.note.trim(),
      },
    });
  }

  if (payload.matchId?.trim()) {
    await prisma.match
      .update({
        where: { id: payload.matchId.trim() },
        data: { status: "Submitted", jobCandidateId },
      })
      .catch(() => undefined);
  }

  return { outcome: "success", message: "Candidate pushed to hiring manager" };
}

async function handlePauseRequisition(
  approval: AgentActionApproval,
): Promise<ExecutionResult> {
  const jobReqId = approval.jobReqId?.trim();

  if (!jobReqId) {
    return { outcome: "failure", message: "Missing job context" };
  }

  const payload = (approval.actionPayload ?? {}) as PauseRequisitionPayload;
  const status = payload.newStatus?.trim() || "On Hold";

  await prisma.jobReq.update({
    where: { id: jobReqId },
    data: { status },
  });

  return { outcome: "success", message: `Job requisition paused (${status})` };
}

export async function executeApprovedAction(
  approval: AgentActionApproval,
): Promise<ExecutionResult> {
  let result: ExecutionResult = { outcome: "not_implemented", message: "Unsupported action type" };

  try {
    switch (approval.actionType) {
      case ActionType.PUSH_CANDIDATES:
        result = await handlePushCandidates(approval);
        break;
      case ActionType.PAUSE_REQUISITION:
        result = await handlePauseRequisition(approval);
        break;
      case ActionType.ESCALATE_TO_HM:
        result = { outcome: "not_implemented", message: "ESCALATE_TO_HM not yet implemented" };
        break;
      default:
        result = { outcome: "not_implemented", message: `Action ${approval.actionType} not implemented` };
    }
  } catch (error) {
    result = { outcome: "failure", message: (error as Error).message };
  }

  await logDecisionStreamOutcome(approval, result);

  return result;
}
