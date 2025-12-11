import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as matchPost } from "@/app/api/agents/matcher/route";

const {
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
  mockUserFindUnique,
  mockMatchJobToAllCandidates,
  mockPersistCandidateConfidenceScore,
  mockPrisma,
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

  const mockPrisma = {
    agentRunLog: {
      create: mockAgentRunLogCreate,
      update: mockAgentRunLogUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  } as const;

  return {
    mockAgentRunLogCreate,
    mockAgentRunLogUpdate,
    mockUserFindUnique,
    mockMatchJobToAllCandidates,
    mockPersistCandidateConfidenceScore,
    mockPrisma,
    mockGetCurrentUser,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
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
    vi.clearAllMocks();
    mockMatchJobToAllCandidates.mockResolvedValue(
      matchResults.map((match) => ({ ...match, reasons: { summary: "LLM explanation" } } as any)),
    );
  });

  it("returns matches and records a successful agent run", async () => {
    const request = new NextRequest(
      new Request("http://localhost/api/agents/match", {
        method: "POST",
        body: JSON.stringify({ recruiterId: "recruiter-1", jobId: "job-1", topN: 2 }),
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await matchPost(request);
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
          confidence: expect.any(Number),
        }),
        expect.objectContaining({
          candidateId: "cand-1",
          jobReqId: "job-1",
          matchScore: 70,
          explanationId: "match-1",
          confidence: expect.any(Number),
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

    const request = new NextRequest(
      new Request("http://localhost/api/agents/match", {
        method: "POST",
        body: JSON.stringify({ recruiterId: "recruiter-1", jobId: "job-err" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await matchPost(request);

    expect(response.status).toBe(500);
    expect(mockAgentRunLogCreate).toHaveBeenCalled();
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("rejects unauthorized roles", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "recruiter-1",
      tenantId: "tenant-1",
      role: "SALES",
    });

    const request = new NextRequest(
      new Request("http://localhost/api/agents/match", {
        method: "POST",
        body: JSON.stringify({ recruiterId: "recruiter-1", jobId: "job-1", topN: 2 }),
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await matchPost(request);

    expect(response.status).toBe(403);
    expect(mockAgentRunLogCreate).not.toHaveBeenCalled();
  });
});
