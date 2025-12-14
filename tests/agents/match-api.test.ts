import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as matchPost } from "@/app/api/jobs/[jobReqId]/matcher/route";
import { mockDb } from "@/test-helpers/db";
import { makeRequest } from "@tests/test-utils/routeHarness";

const {
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
  mockUserFindUnique,
  mockMatchJobToAllCandidates,
  mockPersistCandidateConfidenceScore,
  mockGetCurrentUser,
} = vi.hoisted(() => {
  const mockAgentRunLogCreate = vi.fn(async ({ data }) => ({ id: "run-1", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockUserFindUnique = vi.fn(async () => ({ id: "recruiter-1", tenantId: "tenant-1" }));
  const mockMatchJobToAllCandidates = vi.fn();
  const mockPersistCandidateConfidenceScore = vi.fn(async () => ({ score: 88 }));
  const mockGetCurrentUser = vi.fn().mockResolvedValue({
    id: "recruiter-1",
    tenantId: "tenant-1",
    role: "RECRUITER",
  });

  return {
    mockAgentRunLogCreate,
    mockAgentRunLogUpdate,
    mockUserFindUnique,
    mockMatchJobToAllCandidates,
    mockPersistCandidateConfidenceScore,
    mockGetCurrentUser,
  };
});

const { prisma, resetDbMocks } = mockDb();

vi.mock("@/lib/killSwitch", () => ({ assertKillSwitchDisarmed: vi.fn(), KILL_SWITCHES: { AGENTS: "AGENTS" } }));
vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  AGENT_KILL_SWITCHES: { MATCHER: "ETE-TS.MATCHER" },
  enforceAgentKillSwitch: vi.fn(),
}));
vi.mock("@/lib/subscription/usageLimits", () => ({ assertTenantWithinLimits: vi.fn() }));
vi.mock("@/lib/candidates/confidenceScore", () => ({
  persistCandidateConfidenceScore: mockPersistCandidateConfidenceScore,
}));
vi.mock("@/lib/matching/batch", () => ({ matchJobToAllCandidates: mockMatchJobToAllCandidates }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/config/ts", () => ({
  TS_CONFIG: {
    matcher: {
      minScore: 50,
      weight: { skills: 0.5, seniority: 0.3, location: 0.1, candidateSignals: 0.1 },
    },
  },
}));

const matchResults = [
  {
    id: "match-1",
    tenantId: "tenant-1",
    candidateId: "cand-1",
    jobReqId: "job-1",
    score: 70,
    reasons: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    deletedAt: null,
  },
  {
    id: "match-2",
    tenantId: "tenant-1",
    candidateId: "cand-2",
    jobReqId: "job-1",
    score: 90,
    reasons: null,
    createdAt: new Date("2024-01-02T00:00:00Z"),
    deletedAt: null,
  },
];

describe("MATCH agent API", () => {
  beforeEach(() => {
    resetDbMocks();
    prisma.agentRunLog.create.mockImplementation(mockAgentRunLogCreate);
    prisma.agentRunLog.update.mockImplementation(mockAgentRunLogUpdate);
    prisma.user.findUnique.mockImplementation(mockUserFindUnique);
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: "recruiter-1",
      tenantId: "tenant-1",
      role: "RECRUITER",
    });
    mockMatchJobToAllCandidates.mockResolvedValue(
      matchResults.map(
        (match) =>
          ({
            ...match,
            reasons: { summary: "LLM explanation" },
            candidateSignalBreakdown: {
              confidence: { score: match.score / 100, category: "HIGH", reasons: ["Strong skills match"] },
            },
          }) as any,
      ),
    );
  });

  it("returns matches and records a successful agent run", async () => {
    const request = makeRequest({
      method: "POST",
      url: "http://localhost/api/jobs/job-1/matcher",
      json: { recruiterId: "recruiter-1", topN: 2 },
    });

    const response = await matchPost(request, { params: { jobReqId: "job-1" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      jobId: "job-1",
      agentRunId: "run-1",
      matches: [
        expect.objectContaining({
          candidateId: "cand-2",
          jobReqId: "job-1",
          matchScore: 90,
          explanationId: "match-2",
          confidence: 0.9,
          confidenceCategory: "HIGH",
          confidenceReasons: ["Strong skills match"],
        }),
        expect.objectContaining({
          candidateId: "cand-1",
          jobReqId: "job-1",
          matchScore: 70,
          explanationId: "match-1",
          confidence: 0.7,
          confidenceCategory: "HIGH",
          confidenceReasons: ["Strong skills match"],
        }),
      ],
    });
    expect(mockAgentRunLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RUNNING" }) }),
    );
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS" }) }),
    );
    expect(mockMatchJobToAllCandidates).toHaveBeenCalledWith("job-1", 2);
  });

  it("marks failed runs when matching errors", async () => {
    mockMatchJobToAllCandidates.mockRejectedValue(new Error("matching failed"));

    const request = makeRequest({
      method: "POST",
      url: "http://localhost/api/jobs/job-err/matcher",
      json: { recruiterId: "recruiter-1" },
    });

    const response = await matchPost(request, { params: { jobReqId: "job-err" } });

    expect(response.status).toBe(500);
    expect(mockAgentRunLogCreate).toHaveBeenCalled();
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("fails when no authenticated user is available", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const request = makeRequest({
      method: "POST",
      url: "http://localhost/api/jobs/job-1/matcher",
      json: { recruiterId: "recruiter-1", topN: 2 },
    });

    const response = await matchPost(request, { params: { jobReqId: "job-1" } });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Unauthorized" });
    expect(mockAgentRunLogCreate).not.toHaveBeenCalled();
  });
});
