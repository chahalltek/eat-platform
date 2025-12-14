import { Prisma, type AgentActionApproval, ActionType, ExecutionStatus } from "@/server/db";

type ExecutionOutcome = {
  status: ExecutionStatus;
  result: Prisma.InputJsonValue;
};

async function performActionExecution(
  approval: AgentActionApproval,
): Promise<Prisma.InputJsonValue> {
  switch (approval.actionType) {
    case ActionType.WIDEN_CRITERIA:
      return { message: "Criteria widened", details: approval.actionPayload };
    case ActionType.ADJUST_COMP:
      return { message: "Compensation adjusted", details: approval.actionPayload };
    case ActionType.SOURCE_EXTERNALLY:
      return { message: "External sourcing initiated", details: approval.actionPayload };
    case ActionType.ESCALATE_TO_HM:
      return { message: "Escalated to hiring manager", details: approval.actionPayload };
    case ActionType.PUSH_CANDIDATES:
      return { message: "Candidates pushed", details: approval.actionPayload };
    case ActionType.PAUSE_REQUISITION:
      return { message: "Requisition paused", details: approval.actionPayload };
    default:
      throw new Error(`Unsupported action type: ${approval.actionType}`);
  }
}

export async function executeApprovedAction(
  approval: AgentActionApproval,
): Promise<ExecutionOutcome> {
  try {
    const result = await performActionExecution(approval);

    return {
      status: ExecutionStatus.SUCCESS,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error";
    console.error("[executeApprovedAction] Failed to execute action", error);

    return {
      status: ExecutionStatus.FAILED,
      result: { error: message },
    };
  }
}
