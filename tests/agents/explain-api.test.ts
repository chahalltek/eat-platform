import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as explainPost } from "@/app/api/agents/explain/route";

const {
  mockGetTenantScopedPrismaClient,
  mockMatchFindFirst,
  mockCandidateMatchFindFirst,
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
} = vi.hoisted(() => {
  const mockMatchFindFirst = vi.fn();
  const mockCandidateMatchFindFirst = vi.fn();
  const mockAgentRunLogCreate = vi.fn(async (_client, { data }) => ({ id: "run-123", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));

  const scopedPrisma = {
    match: { findFirst: mockMatchFindFirst },
    candidateMatch: { findFirst: mockCandidateMatchFindFirst },
    agentRunLog: { update: mockAgentRunLogUpdate },
  } as const;

  const mockGetTenantScopedPrismaClient = vi.fn(async () => ({
    prisma: scopedPrisma as any,
    tenantId: "tenant-1",
    runWithTenantContext: async <T>(fn: () => Promise<T>) => fn(),
  }));

  return {
    mockGetTenantScopedPrismaClient,
    mockMatchFindFirst,
    mockCandidateMatchFindFirst,
    mockAgentRunLogCreate,
    mockAgentRunLogUpdate,
  };
});

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(async () => ({ ok: true, user: { id: "user-1" } })),
}));

const { mockCallLLM } = vi.hoisted(() => ({
  mockCallLLM: vi.fn(),
}));

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

vi.mock("@/lib/agents/agentRunLog", () => ({
  createAgentRunLog: mockAgentRunLogCreate,
}));

vi.mock("@/lib/llm", () => ({ callLLM: mockCallLLM }));

vi.mock("@/lib/auth/requireRole", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/featureFlags/middleware", () => ({ agentFeatureGuard: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/agents/killSwitch", () => ({
  AGENT_KILL_SWITCHES: { MATCHER: "EAT-TS.MATCHER", MATCH_EXPLAINER: "EAT-TS.EXPLAIN" },
  enforceAgentKillSwitch: vi.fn().mockResolvedValue(null),
}));

const mockMatch = {
  id: "match-1",
  tenantId: "tenant-1",
  matchScore: 82,
  jobReq: {
    title: "Engineer",
    rawDescription: "Build things",
    skills: [{ name: "TypeScript", normalizedName: "typescript" }],
  },
  candidate: {
    fullName: "Jane Doe",
    currentTitle: "Developer",
    location: "Remote",
    summary: "Great dev",
    skills: [{ name: "TypeScript", normalizedName: "typescript" }],
  },
};

const explanationPayload = {
  topReasons: ["TypeScript match"],
  allReasons: ["TypeScript match"],
  skillOverlapMap: [],
  riskAreas: [],
  missingSkills: [],
  exportableText: "Great fit",
};

describe("EXPLAIN agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallLLM.mockResolvedValue(JSON.stringify(explanationPayload));
    mockMatchFindFirst.mockResolvedValue(mockMatch);
    mockCandidateMatchFindFirst.mockResolvedValue(null);
  });

  it("enforces RBAC", async () => {
    mockRequireRole.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 403 }) });

    const response = await explainPost(
      new NextRequest(new Request("http://localhost/api/agents/explain", { method: "POST", body: "{}" })),
    );

    expect(response.status).toBe(403);
    expect(mockGetTenantScopedPrismaClient).not.toHaveBeenCalled();
  });

  it("scopes match lookups to the tenant and records agent runs", async () => {
    const response = await explainPost(
      new NextRequest(
        new Request("http://localhost/api/agents/explain", {
          method: "POST",
          body: JSON.stringify({ matchId: "match-1" }),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetTenantScopedPrismaClient).toHaveBeenCalled();
    expect(mockMatchFindFirst).toHaveBeenCalledWith({
      where: { id: "match-1", tenantId: "tenant-1" },
      include: expect.any(Object),
    });
    expect(mockAgentRunLogCreate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: "RUNNING",
        agentName: "EAT-TS.EXPLAIN",
      }),
    );
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
    expect(body).toEqual({ agentRunId: "run-123", explanation: expect.any(Object) });
    expect(body.explanation.topReasons).toEqual(["TypeScript match"]);
  });
});
