import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  finishAgentRunError,
  finishAgentRunSuccess,
  startAgentRun,
} from "@/lib/agentRunLog";

const { mockAgentRunLogCreate, mockAgentRunLogUpdate, AgentRunStatus } = vi.hoisted(() => ({
  mockAgentRunLogCreate: vi.fn(),
  mockAgentRunLogUpdate: vi.fn(),
  AgentRunStatus: {
    RUNNING: "RUNNING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
  } as const,
}));

vi.mock("@/server/db/prisma", () => ({
  AgentRunStatus,
  prisma: {
    agentRunLog: {
      create: mockAgentRunLogCreate,
      update: mockAgentRunLogUpdate,
    },
  },
}));

describe("agentRunLog helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts an agent run with normalized input", async () => {
    mockAgentRunLogCreate.mockResolvedValue({ id: "run-1" });

    const { runId } = await startAgentRun({
      agentName: "TEST_AGENT",
      tenantId: "tenant-123",
      userId: "user-123",
      input: { foo: "bar" },
    });

    expect(runId).toBe("run-1");
    expect(mockAgentRunLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentName: "TEST_AGENT",
        tenantId: "tenant-123",
        userId: "user-123",
        input: { foo: "bar" },
        inputSnapshot: { foo: "bar" },
        status: AgentRunStatus.RUNNING,
        startedAt: expect.any(Date),
      }),
    });
  });

  it("finishes a run successfully", async () => {
    await finishAgentRunSuccess({
      runId: "run-2",
      output: { message: "ok" },
      tokensCompletion: 10,
      tokensPrompt: 5,
      durationMs: 200,
      retryCount: 1,
      retryPayload: { nextAttemptAt: "2024-02-01T00:00:00.000Z" },
    });

    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith({
      where: { id: "run-2" },
      data: expect.objectContaining({
        status: AgentRunStatus.SUCCESS,
        output: { message: "ok" },
        outputSnapshot: { message: "ok" },
        tokensPrompt: 5,
        tokensCompletion: 10,
        durationMs: 200,
        retryCount: 1,
        retryPayload: { nextAttemptAt: "2024-02-01T00:00:00.000Z" },
        errorMessage: null,
        finishedAt: expect.any(Date),
      }),
    });
  });

  it("finishes a run with error", async () => {
    await finishAgentRunError({
      runId: "run-3",
      errorMessage: "Something went wrong",
      durationMs: 500,
      retryCount: 2,
      retryPayload: { nextAttemptAt: "2024-02-01T01:00:00.000Z" },
    });

    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith({
      where: { id: "run-3" },
      data: expect.objectContaining({
        status: AgentRunStatus.FAILED,
        errorMessage: "Something went wrong",
        durationMs: 500,
        retryCount: 2,
        retryPayload: { nextAttemptAt: "2024-02-01T01:00:00.000Z" },
        finishedAt: expect.any(Date),
      }),
    });
  });
});
