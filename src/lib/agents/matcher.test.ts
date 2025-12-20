import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS" },
}));

vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  AGENT_KILL_SWITCHES: { MATCHER: "ETE-TS.MATCHER" },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/subscription/usageLimits", () => ({
  assertTenantWithinLimits: vi.fn(),
}));

const { mockAgentRunLogCreate, mockAgentRunLogUpdate, mockMatchResultCreate, mockPrisma } = vi.hoisted(() => {
  const mockAgentRunLogCreate = vi.fn(async ({ data }) => ({ id: "run-123", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockMatchResultCreate = vi.fn(async ({ data }) => ({ id: `match-${Math.random()}`, ...data }));
  const mockUserFindUnique = vi.fn(async () => ({ id: "test-user", tenantId: "tenant" }));

  const mockPrisma = {
    agentRunLog: {
      create: mockAgentRunLogCreate,
      update: mockAgentRunLogUpdate,
    },
    matchResult: {
      create: mockMatchResultCreate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  };

  return { mockAgentRunLogCreate, mockAgentRunLogUpdate, mockMatchResultCreate, mockPrisma };
});

vi.mock("@/server/db/prisma", () => ({
  Prisma,
  prisma: mockPrisma,
}));

vi.mock("@/lib/matching/batch", () => ({
  matchJobToAllCandidates: vi.fn(),
}));

const matcherAgent = await import("@/lib/agents/matcher");
const { matchJobToAllCandidates } = await import("@/lib/matching/batch");
const { getCurrentUser } = await import("@/lib/auth");

describe("matcher agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "test-user",
      email: null,
      displayName: null,
      role: null,
      tenantId: "tenant",
    });
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

  it("records deterministic output with explanations and signal breakdowns", async () => {
    const deterministicMatch = {
      id: "match-deterministic",
      tenantId: "tenant",
      candidateId: "cand-1",
      jobReqId: "job-1",
      score: 88,
      reasons: {
        topReasons: ["Required skill matched: React"],
        allReasons: ["Required skill matched: React", "Missing nice-to-have skill: GraphQL"],
        missingSkills: ["GraphQL"],
        riskAreas: ["Missing nice-to-have skill: GraphQL"],
        skillOverlapMap: [
          { skill: "React", status: "matched", importance: "required", weight: 2, note: "React aligns" },
          { skill: "GraphQL", status: "missing", importance: "preferred", weight: 1, note: "GraphQL missing" },
        ],
        exportableText: "Top reasons: Required skill matched: React; Missing nice-to-have skill: GraphQL.",
      },
      candidateSignalBreakdown: {
        confidence: {
          score: 0.82,
          category: "HIGH",
          reasons: ["Recent outreach"],
          breakdown: { dataCompleteness: 1, skillCoverage: 1, recency: 0.8, total: 0.82 },
        },
      },
      createdAt: new Date("2024-01-01T00:00:00Z"),
      deletedAt: null,
    } as any;

    vi.mocked(matchJobToAllCandidates).mockResolvedValue([deterministicMatch]);

    const [result] = await matcherAgent.runMatcherAgent({ jobReqId: "job-1", limit: 25 });

    expect(result.matches[0]).toEqual(deterministicMatch);

    const outputSnapshot = mockPrisma.agentRunLog.update.mock.calls.at(-1)?.[0]?.data?.outputSnapshot as
      | { matches?: unknown[] }
      | undefined;

    expect(outputSnapshot?.matches?.[0]).toEqual(
      expect.objectContaining({
        id: "match-deterministic",
        score: 88,
        reasons: deterministicMatch.reasons,
        candidateSignalBreakdown: deterministicMatch.candidateSignalBreakdown,
      }),
    );
  });

  it("returns identical ordered results for the same deterministic inputs", async () => {
    const stableMatches = [
      {
        id: "match-stable-a",
        tenantId: "tenant",
        candidateId: "cand-a",
        jobReqId: "job-1",
        score: 91,
        reasons: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        deletedAt: null,
      },
      {
        id: "match-stable-b",
        tenantId: "tenant",
        candidateId: "cand-b",
        jobReqId: "job-1",
        score: 77,
        reasons: null,
        createdAt: new Date("2024-01-02T00:00:00Z"),
        deletedAt: null,
      },
    ];

    vi.mocked(matchJobToAllCandidates).mockResolvedValue(stableMatches);

    const [firstResult] = await matcherAgent.runMatcherAgent({ jobReqId: "job-1", limit: 2 });
    const [secondResult] = await matcherAgent.runMatcherAgent({ jobReqId: "job-1", limit: 2 });

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.matches.map((match) => match.id)).toEqual(["match-stable-a", "match-stable-b"]);
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
