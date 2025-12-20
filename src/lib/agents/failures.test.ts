import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAgentFailureCount } from "@/lib/agents/failures";

const { AgentRunStatus, mockCount } = vi.hoisted(() => ({
  AgentRunStatus: { FAILED: "FAILED" } as const,
  mockCount: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  AgentRunStatus,
  prisma: {
    agentRunLog: {
      count: mockCount,
    },
  },
}));

describe("getAgentFailureCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns zero when tenant id is missing", async () => {
    const result = await getAgentFailureCount("");

    expect(result).toBe(0);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it("counts failures within the last 24 hours by default", async () => {
    const now = new Date("2024-05-20T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    mockCount.mockResolvedValue(3);

    const result = await getAgentFailureCount("tenant-123");

    expect(result).toBe(3);
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-123",
        status: AgentRunStatus.FAILED,
        deletedAt: null,
        startedAt: { gte: new Date("2024-05-19T12:00:00.000Z") },
      },
    });
  });

  it("respects a custom lookback window", async () => {
    const now = new Date("2024-05-20T15:30:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    mockCount.mockResolvedValue(5);

    const result = await getAgentFailureCount("tenant-abc", 60 * 60 * 1000); // 1 hour

    expect(result).toBe(5);
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-abc",
        status: AgentRunStatus.FAILED,
        deletedAt: null,
        startedAt: { gte: new Date("2024-05-20T14:30:00.000Z") },
      },
    });
  });
});
