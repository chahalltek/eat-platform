import { beforeEach, describe, expect, it, vi } from "vitest";

import { runShortlist } from "@/lib/agents/shortlist";

vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS" },
}));

vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  listAgentKillSwitches: vi.fn(async () => []),
  AGENT_KILL_SWITCHES: { MATCHER: "ETE-TS.MATCHER", RANKER: "ETE-TS.RANKER" },
}));

vi.mock("@/lib/subscription/usageLimits", () => ({
  assertTenantWithinLimits: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-123" })),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-123" })),
}));

const {
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
  mockUserFindUnique,
  mockJobFindUnique,
  mockCandidateMatchUpdate,
  mockCandidateMatchUpdateMany,
  mockJobCandidateFindUnique,
  mockJobCandidateCreate,
  mockJobCandidateUpdate,
  mockPrisma,
} = vi.hoisted(() => {
  const mockAgentRunLogCreate = vi.fn(async ({ data }) => ({ id: "run-123", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockUserFindUnique = vi.fn(async ({ where }) => ({ id: where.id, tenantId: "tenant-1" }));
  const mockJobFindUnique = vi.fn();
  const mockCandidateMatchUpdateMany = vi.fn();
  const mockCandidateMatchUpdate = vi.fn();
  const mockJobCandidateFindUnique = vi.fn();
  const mockJobCandidateUpdate = vi.fn();
  const mockJobCandidateCreate = vi.fn();

  const mockPrisma = {
    agentRunLog: {
      create: mockAgentRunLogCreate,
      update: mockAgentRunLogUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    job: {
      findUnique: mockJobFindUnique,
    },
    candidateMatch: {
      updateMany: mockCandidateMatchUpdateMany,
      update: mockCandidateMatchUpdate,
    },
    jobCandidate: {
      findUnique: mockJobCandidateFindUnique,
      update: mockJobCandidateUpdate,
      create: mockJobCandidateCreate,
    },
    $transaction: vi.fn(async (fn) => fn(mockPrisma)),
  };

  return {
    mockAgentRunLogCreate,
    mockAgentRunLogUpdate,
    mockUserFindUnique,
    mockJobFindUnique,
    mockCandidateMatchUpdate,
    mockCandidateMatchUpdateMany,
    mockJobCandidateFindUnique,
    mockJobCandidateCreate,
    mockJobCandidateUpdate,
    mockPrisma,
  };
});

vi.mock("@/lib/prisma", () => {
  return { prisma: mockPrisma };
});

describe("shortlist agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRE_DRILL_MODE = "normal";
  });

  it("ranks candidate matches and records shortlist decisions", async () => {
    const now = new Date("2024-05-01T00:00:00Z");

    mockJobFindUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
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

    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledTimes(3);
    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", candidateId: "cand-1" },
      data: { shortlisted: true, shortlistReason: expect.any(String) },
    });
    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", candidateId: "cand-2" },
      data: { shortlisted: true, shortlistReason: expect.any(String) },
    });
    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", candidateId: "cand-3" },
      data: { shortlisted: false, shortlistReason: null },
    });
    expect(mockJobCandidateCreate).toHaveBeenCalledTimes(2);
    expect(mockJobCandidateCreate).toHaveBeenCalledWith({
      data: {
        candidateId: "cand-1",
        jobReqId: "job-1",
        tenantId: "tenant-1",
        status: "SHORTLISTED",
      },
    });
    expect(mockJobCandidateCreate).toHaveBeenCalledWith({
      data: {
        candidateId: "cand-2",
        jobReqId: "job-1",
        tenantId: "tenant-1",
        status: "SHORTLISTED",
      },
    });
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

  it("applies guardrail thresholds when ranking", async () => {
    mockJobFindUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
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
      ],
    });

    const result = await runShortlist(
      { jobId: "job-1" },
      {},
      { shortlistMinScore: 90, shortlistMaxCandidates: 1 },
    );

    expect(result.shortlisted).toHaveLength(1);
    expect(result.shortlisted[0]?.matchId).toBe("match-1");
    expect(mockCandidateMatchUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", candidateId: "cand-2" },
      data: { shortlisted: false, shortlistReason: null },
    });
  });
});
