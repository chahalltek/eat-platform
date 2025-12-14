import { NextResponse } from "next/server";

export type ExecutionContractStatus = "SUGGESTION_ONLY" | "EXECUTED" | "REJECTED";

export type ExecutionContractResponse = {
  status: ExecutionContractStatus;
  reason?: string;
};

export function suggestionOnlyResponse(
  reason: string,
  init?: ResponseInit,
  extraFields?: Record<string, unknown>,
) {
  return NextResponse.json<ExecutionContractResponse & Record<string, unknown>>(
    {
      status: "SUGGESTION_ONLY",
      reason,
      ...(extraFields ?? {}),
    },
    init,
  );
}
