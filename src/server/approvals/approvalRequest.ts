import crypto from "crypto";

import {
  ApprovalStatus,
  type ApprovalRequest,
  type ActionType,
} from "@/server/db";
import { logApprovalCheck } from "@/lib/audit/securityEvents";

type ApprovalValidationResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

function sortObject(value: Record<string, unknown>) {
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = value[key];
      return acc;
    }, {});
}

export function hashApprovalPayload(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return crypto.createHash("sha256").update("null").digest("hex");
  }

  const serialized = JSON.stringify(payload, (_key, value) => {
    if (Array.isArray(value)) return value;

    if (value && typeof value === "object") {
      return sortObject(value as Record<string, unknown>);
    }

    return value;
  });

  return crypto.createHash("sha256").update(serialized).digest("hex");
}

export async function validateApprovalRequest(params: {
  approvalRequest: ApprovalRequest | null | undefined;
  actorId: string;
  tenantId: string;
  actionType: ActionType | string;
  actionPayload: unknown;
}): Promise<ApprovalValidationResult> {
  const { approvalRequest, actorId, tenantId, actionType, actionPayload } = params;

  const logResult = (result: "allowed" | "blocked", reason?: string) =>
    logApprovalCheck({
      tenantId,
      userId: actorId,
      approvalRequestId: approvalRequest?.id ?? "unknown",
      actionType: String(actionType),
      requestedBy: approvalRequest?.requestedBy ?? "unknown",
      approvedBy: approvalRequest?.approvedBy,
      status: approvalRequest?.status ?? ApprovalStatus.PENDING,
      expiresAt: approvalRequest?.expiresAt ?? null,
      result,
      reason,
    });

  if (!approvalRequest) {
    await logResult("blocked", "missing_approval_request");
    return { ok: false, status: 400, message: "Missing approval request" };
  }

  if (approvalRequest.requestedBy !== actorId) {
    await logResult("blocked", "actor_mismatch");
    return { ok: false, status: 403, message: "Approval was not requested by this actor" };
  }

  if (approvalRequest.expiresAt && approvalRequest.expiresAt.getTime() < Date.now()) {
    await logResult("blocked", "approval_expired");
    return { ok: false, status: 410, message: "Approval request expired" };
  }

  const expectedHash = approvalRequest.payloadHash;
  const actualHash = hashApprovalPayload(actionPayload);

  if (expectedHash !== actualHash) {
    await logResult("blocked", "payload_mismatch");
    return { ok: false, status: 409, message: "Approval payload does not match request" };
  }

  if (approvalRequest.actionType !== String(actionType)) {
    await logResult("blocked", "action_type_mismatch");
    return { ok: false, status: 409, message: "Approval action type does not match request" };
  }

  if (approvalRequest.status !== ApprovalStatus.APPROVED) {
    await logResult("blocked", approvalRequest.status.toLowerCase());
    return { ok: false, status: 409, message: "Approval request is not approved" };
  }

  await logResult("allowed");
  return { ok: true };
}
