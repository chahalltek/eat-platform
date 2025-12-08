import { beforeEach, describe, expect, it, vi } from "vitest";

import { runShortlist } from "@/lib/agents/shortlist";

vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS" },
}));

vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  AGENT_KILL_SWITCHES: { MATCHER: "EAT-TS.MATCHER", RANKER: "EAT-TS.RANKER" },
}));

vi.mock("@/lib/subscription/usageLimits", () => ({
  assertTenantWithinLimits: vi.fn(),
}));

const {
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
  mockJobFindUnique,
  mockCandidateMatchUpdate,
  mockCandidateMatchUpdateMany,
  mockPrisma,
} = vi.hoisted(() => {
  const mockAgentRunLogCreate = vi.fn(async ({ data }) => ({ id: "run-123", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockJobFindUnique = vi.fn();
  const mockCandidateMatchUpdateMany = vi.fn();
  const mockCandidateMatchUpdate = vi.fn();

  const mockPrisma = {
    agentRunLog: {
      create: mockAgentRunLogCreate,
      update: mockAgentRunLogUpdate,
    },
    job: {
      findUnique: mockJobFindUnique,
    },
    candidateMatch: {
      updateMany: mockCandidateMatchUpdateMany,
      update: mockCandidateMatchUpdate,
    },
    $transaction: vi.fn(async (fn) => fn(mockPrisma)),
  };

  return {
    mockAgentRunLogCreate,
    mockAgentRunLogUpdate,
    mockJobFindUnique,
    mockCandidateMatchUpdate,
    mockCandidateMatchUpdateMany,
    mockPrisma,
  };
});

vi.mock("@/lib/prisma", () => {
  return { prisma: mockPrisma };
});

describe("shortlist agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ranks candidate matches and records shortlist decisions", async () => {
    const now = new Date("2024-05-01T00:00:00Z");

    mockJobFindUnique.mockResolvedValue({
      id: "job-1",
      requiredSkills: ["TypeScript", "SQL", "AWS"],
      matches: [
        {
          id: "match-1",
          jobId: "job-1",
          candidateId: "cand-1",
          matchScore: 92,
          confidence: 75,
          explanation: {},
          confidenceReasons: null,
          createdAt: new Date("2024-04-01T00:00:00Z"),
          candidate: {
            id: "cand-1",
            normalizedSkills: ["typescript", "aws", "docker"],
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-04-10T00:00:00Z"),
          },
        },
        {
          id: "match-2",
          jobId: "job-1",
          candidateId: "cand-2",
          matchScore: 88,
          confidence: 90,
          explanation: {},
          confidenceReasons: null,
          createdAt: new Date("2024-04-02T00:00:00Z"),
          candidate: {
            id: "cand-2",
            normalizedSkills: ["typescript", "sql", "graphql"],
            createdAt: new Date("2024-01-15T00:00:00Z"),
            updatedAt: new Date("2024-04-28T00:00:00Z"),
          },
        },
        {
          id: "match-3",
          jobId: "job-1",
          candidateId: "cand-3",
          matchScore: 70,
          confidence: 55,
          explanation: {},
          confidenceReasons: null,
          createdAt: new Date("2024-04-03T00:00:00Z"),
          candidate: {
            id: "cand-3",
            normalizedSkills: ["python", "aws"],
            createdAt: new Date("2024-02-01T00:00:00Z"),
            updatedAt: new Date("2024-04-29T00:00:00Z"),
          },
        },
      ],
    });

    const result = await runShortlist({ jobId: "job-1", shortlistLimit: 2 }, { now: () => now });

    expect(result.agentRunId).toBe("run-123");
    expect(result.shortlisted.map((entry) => entry.matchId)).toEqual(["match-2", "match-1"]);
    expect(result.totalMatches).toBe(3);

    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1" },
      data: { shortlisted: false, shortlistReason: null },
    });
    expect(mockCandidateMatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockCandidateMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "match-2" },
        data: expect.objectContaining({ shortlisted: true, shortlistReason: expect.any(String) }),
      }),
    );
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS" }) }),
    );
  });

  it("marks the run as failed when the job cannot be found", async () => {
    mockJobFindUnique.mockResolvedValue(null);

    await expect(runShortlist({ jobId: "missing" })).rejects.toThrow(
      "Job missing not found for shortlist agent",
    );

    expect(mockAgentRunLogCreate).toHaveBeenCalled();
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
    expect(mockCandidateMatchUpdateMany).not.toHaveBeenCalled();
  });
});
