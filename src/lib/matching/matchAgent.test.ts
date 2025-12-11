import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { matchJobToAllCandidates } from "@/lib/matching/batch";
import { runMatcher } from "@/lib/agents/matcher";

const { mockPrisma, mockMatchCreate, mockMatchUpdate, mockJobCandidateUpsert, mockAgentRunUpdate } =
  vi.hoisted(() => {
    const mockMatchCreate = vi.fn(async ({ data }) => ({ id: `match-${data.candidateId}`, ...data }));
    const mockMatchUpdate = vi.fn(async ({ data, where }) => ({ id: where.id, ...data }));
    const mockJobCandidateUpsert = vi.fn();
    const mockAgentRunUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));

    const mockPrisma = {
      jobReq: { findUnique: vi.fn() },
      candidate: { findMany: vi.fn() },
      jobCandidate: { findMany: vi.fn() },
      outreachInteraction: { groupBy: vi.fn() },
      matchResult: { findMany: vi.fn(), create: mockMatchCreate, update: mockMatchUpdate },
      agentRunLog: { update: mockAgentRunUpdate },
      user: { findUnique: vi.fn().mockResolvedValue({ id: "recruiter-1", tenantId: "tenant" }) },
      $transaction: vi.fn(),
    } as any;

    return {
      mockPrisma,
      mockMatchCreate,
      mockMatchUpdate,
      mockJobCandidateUpsert,
      mockAgentRunUpdate,
    };
  });

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/featureFlags", () => ({
  FEATURE_FLAGS: { SCORING: "SCORING" },
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS", SCORERS: "SCORERS" },
}));
vi.mock("@/lib/matching/jobCandidate", () => ({
  upsertJobCandidateForMatch: mockJobCandidateUpsert,
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: "recruiter-1", tenantId: "tenant" }),
}));
vi.mock("@/lib/agents/agentRunLog", () => ({
  createAgentRunLog: vi.fn(async (_prisma, data) => ({ id: "agent-run-1", ...data })),
}));
vi.mock("@/lib/subscription/usageLimits", () => ({
  assertTenantWithinLimits: vi.fn(),
}));
vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  AGENT_KILL_SWITCHES: { MATCHER: "ETE-TS.MATCHER" },
}));

const buildCandidate = (id: string, skills: { name: string; normalizedName: string }[]) => ({
  id,
  fullName: `${id} Candidate`,
  email: null,
  phone: null,
  location: "Remote",
  currentTitle: "Engineer",
  currentCompany: "Acme",
  totalExperienceYears: 6,
  seniorityLevel: "Mid",
  summary: null,
  rawResumeText: null,
  sourceType: null,
  sourceTag: null,
  parsingConfidence: null,
  status: null,
  tenantId: "tenant",
  createdAt: new Date("2024-05-01T00:00:00Z"),
  updatedAt: new Date("2024-05-15T00:00:00Z"),
  deletedAt: null,
  skills: skills.map((skill, index) => ({
    id: `${id}-skill-${index}`,
    candidateId: id,
    name: skill.name,
    normalizedName: skill.normalizedName,
    proficiency: "High",
    yearsOfExperience: 3,
    tenantId: "tenant",
  })),
});

const jobReq = {
  id: "job-1",
  customerId: null,
  title: "Frontend Engineer",
  location: "Remote",
  employmentType: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryInterval: null,
  seniorityLevel: "Mid",
  rawDescription: "Build UI",
  status: null,
  sourceType: null,
  sourceTag: null,
  createdAt: new Date("2024-05-10T00:00:00Z"),
  updatedAt: new Date("2024-05-20T00:00:00Z"),
  tenantId: "tenant",
  skills: [
    {
      id: "job-skill-1",
      jobReqId: "job-1",
      name: "React",
      normalizedName: "react",
      required: true,
      weight: 2,
      tenantId: "tenant",
    },
    {
      id: "job-skill-2",
      jobReqId: "job-1",
      name: "GraphQL",
      normalizedName: "graphql",
      required: true,
      weight: 1,
      tenantId: "tenant",
    },
  ],
  matchResults: [],
};

const runJobReqFindUnique = () => {
  mockPrisma.jobReq.findUnique.mockResolvedValue(jobReq);
};

const runCommonMocks = () => {
  mockPrisma.jobCandidate.findMany.mockResolvedValue([]);
  mockPrisma.outreachInteraction.groupBy.mockResolvedValue([]);
  mockPrisma.matchResult.findMany.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation(async (callback) =>
    callback({ ...mockPrisma, jobCandidate: { upsert: mockJobCandidateUpsert } }),
  );
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-01T00:00:00Z"));
  vi.clearAllMocks();
  runJobReqFindUnique();
  runCommonMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("matchJobToAllCandidates", () => {
  it("ranks perfect matches above partial ones and captures skill scores", async () => {
    const perfect = buildCandidate("cand-perfect", [
      { name: "React", normalizedName: "react" },
      { name: "GraphQL", normalizedName: "graphql" },
    ]);
    const partial = buildCandidate("cand-partial", [{ name: "React", normalizedName: "react" }]);

    mockPrisma.candidate.findMany.mockResolvedValue([partial, perfect]);

    const matches = await matchJobToAllCandidates(jobReq.id, 5);

    expect(mockMatchCreate).toHaveBeenCalledTimes(2);
    expect(mockJobCandidateUpsert).toHaveBeenCalledTimes(2);
    expect(matches.map((match) => match.candidateId)).toEqual([
      "cand-perfect",
      "cand-partial",
    ]);
    expect(matches[0].skillScore).toBe(100);
    expect(matches[1].skillScore).toBeLessThan(matches[0].skillScore);
    expect(matches[1].reasons.missingSkills).toContain("GraphQL");
  });

  it("returns an empty list when there are no candidates to score", async () => {
    mockPrisma.candidate.findMany.mockResolvedValue([]);

    const matches = await matchJobToAllCandidates(jobReq.id, 3);

    expect(matches).toEqual([]);
    expect(mockMatchCreate).not.toHaveBeenCalled();
    expect(mockJobCandidateUpsert).not.toHaveBeenCalled();
  });
});

describe("matcher agent flow", () => {
  it("drops candidates below the matcher threshold and sorts the rest", async () => {
    const highScore = {
      id: "match-high",
      candidateId: "cand-a",
      jobReqId: jobReq.id,
      tenantId: "tenant",
      score: 90,
      reasons: [],
      skillScore: 100,
      seniorityScore: 100,
      locationScore: 100,
      candidateSignalScore: 80,
      candidateSignalBreakdown: { confidence: { score: 75, category: "HIGH", reasons: [], breakdown: {} } },
      createdAt: new Date(),
      deletedAt: null,
    } as any;
    const belowThreshold = { ...highScore, id: "match-low", candidateId: "cand-b", score: 50 };

    const batchModule = await import("@/lib/matching/batch");
    vi.spyOn(batchModule, "matchJobToAllCandidates").mockResolvedValue([belowThreshold, highScore]);

    const result = await runMatcher({ jobId: jobReq.id, topN: 10 });

    expect(result.agentRunId).toBe("agent-run-1");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].candidateId).toBe("cand-a");
    expect(result.matches[0].matchScore).toBe(90);
    expect(result.matches[0].confidence).toBe(75);
    expect(mockAgentRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS" }) }),
    );
  });
});

describe("tenant weight configuration", () => {
  it("respects tenant-specific weight overrides", async () => {
    vi.resetModules();
    vi.doMock("@/lib/matching/scoringConfig", async () => {
      const actual = await vi.importActual<typeof import("@/lib/matching/scoringConfig")>(
        "@/lib/matching/scoringConfig",
      );
      return {
        ...actual,
        MATCH_SCORING_WEIGHTS: { skills: 0, seniority: 0, location: 1, candidateSignals: 0 },
      };
    });

    const { computeMatchScore } = await import("@/lib/matching/msa");
    const candidate = buildCandidate("cand-weights", [
      { name: "React", normalizedName: "react" },
      { name: "GraphQL", normalizedName: "graphql" },
    ]);
    const jobWithDifferentLocation = { ...jobReq, location: "New York" } as any;

    const score = computeMatchScore({ candidate, jobReq: jobWithDifferentLocation });

    expect(score.locationScore).toBe(0);
    expect(score.score).toBe(0);
  });
});
