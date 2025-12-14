import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as intakePost } from "@/app/api/agents/intake/route";
import { makeRequest } from "@tests/test-utils/routeHarness";

const {
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
  mockJobReqCreate,
  mockUserFindUnique,
  mockPrisma,
  mockGetTenantScopedPrismaClient,
  mockGetCurrentUser,
} = vi.hoisted(() => {
  const mockAgentRunLogCreate = vi.fn(async ({ data }) => ({ id: "run-1", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockJobReqCreate = vi.fn(async ({ data }) => ({ id: "job-1", ...data }));
  const mockUserFindUnique = vi.fn(async () => ({ id: "recruiter-1", tenantId: "tenant-1" }));
  const mockPrisma = {
    agentRunLog: {
      create: mockAgentRunLogCreate,
      update: mockAgentRunLogUpdate,
    },
    jobReq: {
      create: mockJobReqCreate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  } as const;
  const mockGetTenantScopedPrismaClient = vi.fn(async () => ({
    prisma: mockPrisma as any,
    tenantId: "tenant-1",
    runWithTenantContext: async <T>(callback: () => Promise<T>) => callback(),
  }));
  const mockGetCurrentUser = vi.fn().mockResolvedValue({
    id: "user-1",
    tenantId: "tenant-1",
    role: "RECRUITER",
  });

    return {
      mockAgentRunLogCreate,
      mockAgentRunLogUpdate,
      mockJobReqCreate,
      mockUserFindUnique,
      mockPrisma,
      mockGetTenantScopedPrismaClient,
      mockGetCurrentUser,
    };
  });

const { mockCallLLM } = vi.hoisted(() => ({ mockCallLLM: vi.fn() }));

vi.mock("@/server/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS" },
}));
vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  AGENT_KILL_SWITCHES: { RUA: "ETE-TS.RUA" },
  enforceAgentKillSwitch: vi.fn(),
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
vi.mock("@/lib/featureFlags/middleware", () => ({
  agentFeatureGuard: vi.fn().mockResolvedValue(null),
  enforceFeatureFlag: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/subscription/usageLimits", () => ({ assertTenantWithinLimits: vi.fn() }));
vi.mock("@/lib/agents/promptRegistry", () => ({
  AGENT_PROMPTS: { RUA_SYSTEM: "RUA_SYSTEM" },
  resolveAgentPrompt: vi.fn().mockResolvedValue({ prompt: "prompt", version: "v1" }),
}));
vi.mock("@/lib/llm", () => ({ callLLM: mockCallLLM }));
vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));
vi.mock("@/app/api/agents/recruiterValidation", () => ({
  validateRecruiterId: vi.fn().mockResolvedValue({ recruiterId: "recruiter-1" }),
}));

describe("INTAKE agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs successful runs", async () => {
    mockCallLLM.mockResolvedValue(
      JSON.stringify({
        clientName: "ClientCo",
        title: "Engineer",
        seniorityLevel: "Mid",
        location: "Remote",
        remoteType: "Remote",
        employmentType: "Full-time",
        responsibilitiesSummary: "Build things",
        teamContext: "Team",
        priority: "High",
        status: "Open",
        ambiguityScore: 0.1,
        skills: [{ name: "TS", normalizedName: "ts", isMustHave: true }],
      }),
    );

    const request = makeRequest({
      method: "POST",
      url: "http://localhost/api/agents/intake",
      json: { rawJobText: "A role" },
    });

    const response = await intakePost(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe("Engineer");
    expect(mockGetTenantScopedPrismaClient).toHaveBeenCalled();
    expect(mockAgentRunLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RUNNING" }),
      }),
    );
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
  });

  it("marks failed runs when parsing fails", async () => {
    mockCallLLM.mockResolvedValue("not-json");

    const request = makeRequest({
      method: "POST",
      url: "http://localhost/api/agents/intake",
      json: { rawJobText: "bad" },
    });

    const response = await intakePost(request);

    expect(response.status).toBe(500);
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

    it("denies access for unauthorized roles", async () => {
      mockGetCurrentUser.mockResolvedValueOnce({
        id: "user-1",
        tenantId: "tenant-1",
        role: "SALES",
      });

      const request = makeRequest({
        method: "POST",
        url: "http://localhost/api/agents/intake",
        json: { rawJobText: "A role" },
      });

      const response = await intakePost(request);

      expect(response.status).toBe(403);
      expect(mockAgentRunLogCreate).not.toHaveBeenCalled();
    });
  });
