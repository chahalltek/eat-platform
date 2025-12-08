import { beforeEach, describe, expect, it, vi } from "vitest";

import * as matcherAgent from "@/lib/agents/matcher";
import { matchJobToAllCandidates } from "@/lib/matching/batch";

vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS" },
}));

vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  AGENT_KILL_SWITCHES: { MATCHER: "EAT-TS.MATCHER" },
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: "test-user",
    email: null,
    displayName: null,
    role: null,
    tenantId: "tenant",
  }),
}));

vi.mock("@/lib/subscription/usageLimits", () => ({
  assertTenantWithinLimits: vi.fn(),
}));

const { mockAgentRunLogCreate, mockAgentRunLogUpdate, mockMatchResultCreate, mockPrisma } = vi.hoisted(() => {
  const mockAgentRunLogCreate = vi.fn(async ({ data }) => ({ id: "run-123", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockMatchResultCreate = vi.fn(async ({ data }) => ({ id: `match-${Math.random()}`, ...data }));

  const mockPrisma = {
    agentRunLog: {
      create: mockAgentRunLogCreate,
      update: mockAgentRunLogUpdate,
    },
    matchResult: {
      create: mockMatchResultCreate,
    },
  };

  return { mockAgentRunLogCreate, mockAgentRunLogUpdate, mockMatchResultCreate, mockPrisma };
});

vi.mock("@/lib/prisma", () => {
  return { prisma: mockPrisma };
});

vi.mock("@/lib/matching/batch", () => ({
  matchJobToAllCandidates: vi.fn(),
}));

describe("matcher agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates candidate matches and marks the run as successful", async () => {
    const mockedExplanation = vi.fn(async (match) => ({ ...match, reasons: { note: "mocked" } } as any));

    const mockMatches = [
      {
        id: "match-a",
        tenantId: "tenant",
        candidateId: "cand-1",
        jobReqId: "job-1",
        score: 40,
        reasons: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        deletedAt: null,
      },
      {
        id: "match-b",
        tenantId: "tenant",
        candidateId: "cand-2",
        jobReqId: "job-1",
        score: 80,
        reasons: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        deletedAt: null,
      },
    ];

    vi.mocked(matchJobToAllCandidates).mockImplementation(async () => {
      mockMatches.forEach((match) => mockPrisma.matchResult.create({ data: match }));
      return mockMatches;
    });

    const [result, runId] = await matcherAgent.runMatcherAgent({ jobReqId: "job-1", limit: 10 }, {
      explainMatch: mockedExplanation,
    });

    expect(runId).toBe("run-123");
    expect(mockPrisma.matchResult.create).toHaveBeenCalledTimes(2);
    expect(result.matches.map((match) => match.id)).toEqual(["match-b"]);
    expect(mockedExplanation).toHaveBeenCalledTimes(2);
    expect(mockPrisma.agentRunLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS" }) }),
    );
  });

  it("records a failed run when matching throws", async () => {
    vi.mocked(matchJobToAllCandidates).mockRejectedValue(new Error("matcher blew up"));

    await expect(matcherAgent.runMatcherAgent({ jobReqId: "job-err" })).rejects.toThrow("matcher blew up");

    expect(mockPrisma.agentRunLog.create).toHaveBeenCalled();
    expect(mockPrisma.agentRunLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });
});
