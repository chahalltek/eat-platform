import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as matchPost } from "@/app/api/agents/match/route";

const {
  mockGetTenantScopedPrismaClient,
  mockJobReqFindUnique,
  mockCandidateFindMany,
  mockJobCandidateFindMany,
  mockOutreachGroupBy,
  mockMatchResultFindMany,
  mockMatchFindMany,
  mockAgentRunLogUpdate,
} = vi.hoisted(() => {
  const mockJobReqFindUnique = vi.fn();
  const mockCandidateFindMany = vi.fn();
  const mockJobCandidateFindMany = vi.fn();
  const mockOutreachGroupBy = vi.fn();
  const mockMatchResultFindMany = vi.fn();
  const mockMatchFindMany = vi.fn();
  const mockAgentRunLogUpdate = vi.fn();

  const transactionClient = {
    matchResult: {
      update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
      create: vi.fn(async ({ data }) => ({ id: "match-result-1", ...data })),
    },
    match: {
      update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
      create: vi.fn(async ({ data }) => ({ id: "match-1", ...data })),
    },
    jobCandidate: {
      upsert: vi.fn(async ({ where, create, update }) => ({
        ...where.tenantId_jobReqId_candidateId,
        ...create,
        ...update,
      })),
    },
  } as const;

  const scopedPrisma = {
    jobReq: { findUnique: mockJobReqFindUnique },
    candidate: { findMany: mockCandidateFindMany },
    jobCandidate: { findMany: mockJobCandidateFindMany },
    outreachInteraction: { groupBy: mockOutreachGroupBy },
    matchResult: { findMany: mockMatchResultFindMany },
    match: { findMany: mockMatchFindMany },
    agentRunLog: { update: mockAgentRunLogUpdate },
    $transaction: vi.fn(async (callback) => callback(transactionClient as any)),
  } as const;

  const mockGetTenantScopedPrismaClient = vi.fn(async () => ({
    tenantId: "tenant-1",
    prisma: scopedPrisma as any,
    runWithTenantContext: async <T>(callback: () => Promise<T>) => callback(),
  }));

  return {
    mockGetTenantScopedPrismaClient,
    mockJobReqFindUnique,
    mockCandidateFindMany,
    mockJobCandidateFindMany,
    mockOutreachGroupBy,
    mockMatchResultFindMany,
    mockMatchFindMany,
    mockAgentRunLogUpdate,
  };
});

vi.mock("@/lib/agents/tenantScope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/tenantScope")>(
    "@/lib/agents/tenantScope",
  );

  return {
    ...actual,
    getTenantScopedPrismaClient: mockGetTenantScopedPrismaClient,
    toTenantErrorResponse: actual.toTenantErrorResponse,
  };
});

vi.mock("@/lib/auth/requireRole", () => ({
  requireRole: vi.fn(async () => ({ ok: true, user: { id: "user-1", tenantId: "tenant-1" } })),
}));

const mockAvailability = {
  mode: {
    mode: "pilot",
    metadata: {},
    guardrailsPreset: "human-vetted",
    agentEnablement: { basic: true, shortlist: true, agents: true },
  },
  confidenceEnabled: true,
  explainEnabled: true,
  shortlistEnabled: true,
} as const;

vi.mock("@/lib/agents/availability", () => ({
  getAgentAvailability: vi.fn(async () => mockAvailability),
}));

vi.mock("@/lib/agents/agentRunLog", () => ({
  createAgentRunLog: vi.fn(async () => ({ id: "agent-run-1" })),
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: "user-1" }) }));
vi.mock("@/lib/featureFlags/middleware", () => ({ agentFeatureGuard: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/agents/killSwitch", () => ({
  AGENT_KILL_SWITCHES: { MATCHER: "ETE-TS.MATCHER" },
  enforceAgentKillSwitch: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/llm", () => ({ callLLM: vi.fn().mockResolvedValue("LLM explanation") }));

const requestPayload = { jobReqId: "job-1", candidateIds: ["cand-1"], limit: 10 };

describe("/api/agents/match", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockJobReqFindUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      title: "Engineer",
      rawDescription: "Role desc",
      createdAt: new Date(),
      updatedAt: new Date(),
      skills: [],
      matchResults: [],
    });

    mockCandidateFindMany.mockResolvedValue([
      {
        id: "cand-1",
        tenantId: "tenant-1",
        fullName: "Cand One",
        summary: "",
        rawResumeText: "resume",
        createdAt: new Date(),
        skills: [],
      },
    ]);

    mockJobCandidateFindMany.mockResolvedValue([]);
    mockOutreachGroupBy.mockResolvedValue([]);
    mockMatchResultFindMany.mockResolvedValue([]);
    mockMatchFindMany.mockResolvedValue([]);
    mockAgentRunLogUpdate.mockResolvedValue({});
  });

  it("runs the matcher for the resolved tenant", async () => {
    const response = await matchPost(
      new NextRequest(
        new Request("http://localhost/api/agents/match", {
          method: "POST",
          body: JSON.stringify(requestPayload),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(mockGetTenantScopedPrismaClient).toHaveBeenCalled();
    expect(mockJobReqFindUnique).toHaveBeenCalledWith({
      where: { id: "job-1", tenantId: "tenant-1" },
      include: expect.any(Object),
    });
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
  });

  it("rejects requests when tenant resolution fails", async () => {
    const { TenantScopeError } = await import("@/lib/agents/tenantScope");

    mockGetTenantScopedPrismaClient.mockRejectedValueOnce(
      new TenantScopeError("Invalid tenant", 403),
    );

    const response = await matchPost(
      new NextRequest(
        new Request("http://localhost/api/agents/match", {
          method: "POST",
          body: JSON.stringify(requestPayload),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(response.status).toBe(403);
  });
});
