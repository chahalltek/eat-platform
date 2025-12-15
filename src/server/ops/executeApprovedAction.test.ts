import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();

  return {
    ...actual,
    ActionType:
      actual.ActionType ??
      (actual as any).Prisma?.ActionType ?? {
        WIDEN_CRITERIA: "WIDEN_CRITERIA",
        ADJUST_COMP: "ADJUST_COMP",
        SOURCE_EXTERNALLY: "SOURCE_EXTERNALLY",
        ESCALATE_TO_HM: "ESCALATE_TO_HM",
        PUSH_CANDIDATES: "PUSH_CANDIDATES",
        PAUSE_REQUISITION: "PAUSE_REQUISITION",
      },
    ExecutionStatus:
      actual.ExecutionStatus ??
      (actual as any).Prisma?.ExecutionStatus ?? { SUCCESS: "SUCCESS", FAILED: "FAILED" },
  };
});

import { executeApprovedAction } from "@/server/ops/executeApprovedAction";
import { ActionType, ExecutionStatus } from "@/server/db";

describe("executeApprovedAction", () => {
  it("returns a failed result for unsupported action types", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await executeApprovedAction({
      actionType: "INVALID_ACTION" as unknown as ActionType,
      actionPayload: { details: "none" },
    } as any);

    expect(result.status).toBe(ExecutionStatus.FAILED);
    expect(result.result).toEqual({ error: "Unsupported action type: INVALID_ACTION" });

    consoleErrorSpy.mockRestore();
  });
});
