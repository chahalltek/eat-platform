import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as explainPost } from "@/app/api/agents/explain/route";

const {
  mockGetTenantScopedPrismaClient,
  mockMatchFindFirst,
  mockCandidateMatchFindFirst,
  mockMatchUpdate,
  mockCandidateMatchUpdate,
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
} = vi.hoisted(() => {
  const mockMatchFindFirst = vi.fn();
  const mockCandidateMatchFindFirst = vi.fn();
  const mockMatchUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockCandidateMatchUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockAgentRunLogCreate = vi.fn(async (_client, { data }) => ({ id: "run-123", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));

  const scopedPrisma = {
    match: { findFirst: mockMatchFindFirst, update: mockMatchUpdate },
    candidateMatch: { findFirst: mockCandidateMatchFindFirst, update: mockCandidateMatchUpdate },
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
    mockMatchUpdate,
    mockCandidateMatchUpdate,
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

const { mockGetAgentAvailability, mockIsEnabled, baseAvailability } = vi.hoisted(() => {
  const mockIsEnabled = vi.fn(() => true);
  const baseAvailability = { isEnabled: mockIsEnabled, mode: { mode: "standard" }, flags: [] } as const;

  return {
    mockGetAgentAvailability: vi.fn(async () => baseAvailability),
    mockIsEnabled,
    baseAvailability,
  };
});

const { mockLoadTenantConfig } = vi.hoisted(() => ({
  mockLoadTenantConfig: vi.fn(),
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
vi.mock("@/lib/agents/agentAvailability", () => ({ getAgentAvailability: mockGetAgentAvailability }));
vi.mock("@/lib/guardrails/tenantConfig", () => ({ loadTenantConfig: mockLoadTenantConfig }));
vi.mock("@/lib/featureFlags/middleware", () => ({ agentFeatureGuard: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/agents/killSwitch", () => ({
  AGENT_KILL_SWITCHES: { MATCHER: "ETE-TS.MATCHER", MATCH_EXPLAINER: "ETE-TS.EXPLAIN" },
  enforceAgentKillSwitch: vi.fn().mockResolvedValue(null),
}));

const mockMatch = {
  id: "match-1",
  tenantId: "tenant-1",
  matchScore: 82,
  scoreBreakdown: {
    signals: {
      mustHaveSkillsCoverage: 0.8,
      niceToHaveSkillsCoverage: 0.6,
      experienceAlignment: 0.7,
      locationAlignment: 0.9,
    },
    confidence: { score: 82, category: "HIGH", reasons: ["Good data"] },
  },
  jobReq: {
    id: "job-1",
    title: "Engineer",
    rawDescription: "Build things",
    skills: [{ name: "TypeScript", normalizedName: "typescript" }],
  },
  candidate: {
    id: "candidate-1",
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

const guardrails = { explain: { includeWeights: false } };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

function buildPersistedExplanation() {
  const jobContext = {
    id: mockMatch.jobReq.id,
    location: mockMatch.jobReq.location ?? null,
    seniorityLevel: (mockMatch.jobReq as { seniorityLevel?: string | null }).seniorityLevel ?? null,
    skills: mockMatch.jobReq.skills.map((skill) => ({
      name: skill.name,
      normalizedName: skill.normalizedName,
      required: true,
    })),
  };

  const candidateContext = {
    id: mockMatch.candidate.id,
    location: mockMatch.candidate.location ?? null,
    seniorityLevel: (mockMatch.candidate as { seniorityLevel?: string | null }).seniorityLevel ?? null,
    totalExperienceYears: (mockMatch.candidate as { totalExperienceYears?: number | null }).totalExperienceYears ?? null,
    skills: (mockMatch.candidate.skills as Array<{ name: string; normalizedName?: string | null }>).map((skill) => ({
      name: skill.name,
      normalizedName: skill.normalizedName ?? undefined,
    })),
  };

  const confidence = { score: 82, category: "HIGH", reasons: ["Good data"] };

  const fingerprints = {
    mode: "standard",
    guardrails: stableStringify(guardrails),
    job: stableStringify({ ...jobContext, skills: [...jobContext.skills].sort((a, b) => a.name.localeCompare(b.name)) }),
    candidate: stableStringify({
      ...candidateContext,
      skills: [...candidateContext.skills].sort((a, b) => a.name.localeCompare(b.name)),
    }),
    match: stableStringify({
      candidateId: mockMatch.candidate.id,
      score: mockMatch.matchScore,
      signals: mockMatch.scoreBreakdown.signals,
      confidence,
    }),
  } as const;

  return {
    version: 1 as const,
    updatedAt: new Date().toISOString(),
    explanation: explanationPayload,
    fingerprints,
  };
}

describe("EXPLAIN agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallLLM.mockResolvedValue(JSON.stringify(explanationPayload));
    mockMatchFindFirst.mockResolvedValue(mockMatch);
    mockCandidateMatchFindFirst.mockResolvedValue(null);
    mockLoadTenantConfig.mockResolvedValue(guardrails);
    mockGetAgentAvailability.mockResolvedValue(baseAvailability);
    mockIsEnabled.mockReturnValue(true);
    (baseAvailability as { mode: { mode: string } }).mode = { mode: "standard" };
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
        agentName: "ETE-TS.EXPLAIN",
      }),
    );
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
    expect(body).toEqual({
      agentRunId: "run-123",
      candidateId: "candidate-1",
      mode: "standard",
      explanation: expect.objectContaining({
        summary: expect.any(String),
        strengths: expect.any(Array),
        risks: expect.any(Array),
      }),
    });
    expect(typeof body.explanation.summary).toBe("string");
  });

  it("reuses a cached explanation when fingerprints match", async () => {
    const firstResponse = await explainPost(
      new NextRequest(
        new Request("http://localhost/api/agents/explain", {
          method: "POST",
          body: JSON.stringify({ matchId: "match-1" }),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(firstResponse.status).toBe(200);
    const persistedPayload = mockMatchUpdate.mock.calls.at(-1)?.[0]?.data.explanation as string;

    mockCallLLM.mockClear();
    mockAgentRunLogUpdate.mockClear();
    mockMatchFindFirst.mockResolvedValueOnce({ ...mockMatch, explanation: persistedPayload });

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
    expect(mockCallLLM).not.toHaveBeenCalled();
    expect(body.explanation.summary).toBeDefined();
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUCCESS",
          output: expect.objectContaining({ cached: true }),
        }),
      }),
    );
  });

  it("forces regeneration when requested", async () => {
    const persisted = buildPersistedExplanation();
    mockMatchFindFirst.mockResolvedValueOnce({ ...mockMatch, explanation: JSON.stringify(persisted) });

    const response = await explainPost(
      new NextRequest(
        new Request("http://localhost/api/agents/explain", {
          method: "POST",
          body: JSON.stringify({ matchId: "match-1", force: true }),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(mockCallLLM).toHaveBeenCalled();
    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "match-1" },
      }),
    );
  });

  it("returns a minimal explanation in fire drill mode", async () => {
    const fireDrillAvailability = { ...baseAvailability, isEnabled: vi.fn(() => false), mode: { mode: "fire_drill" } };
    mockGetAgentAvailability.mockResolvedValueOnce(fireDrillAvailability);

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
    expect(body.mode).toBe("fire_drill");
    expect(body.explanation).toEqual({ summary: expect.any(String), strengths: [], risks: [] });
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it("blocks the agent when availability is disabled", async () => {
    mockIsEnabled.mockReturnValueOnce(false);

    const response = await explainPost(
      new NextRequest(
        new Request("http://localhost/api/agents/explain", {
          method: "POST",
          body: JSON.stringify({ matchId: "match-1" }),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(response.status).toBe(403);
    expect(mockAgentRunLogCreate).not.toHaveBeenCalled();
  });
});
