import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as intakePost } from "@/app/api/agents/intake/route";

const {
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
  mockJobReqCreate,
  mockUserFindUnique,
  mockPrisma,
<<<<<<< ours
  mockGetTenantScopedPrismaClient,
=======
  mockGetCurrentUser,
>>>>>>> theirs
} = vi.hoisted(() => {
  const mockAgentRunLogCreate = vi.fn(async ({ data }) => ({ id: "run-1", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockJobReqCreate = vi.fn(async ({ data }) => ({ id: "job-1", ...data }));
  const mockUserFindUnique = vi.fn(async () => ({ id: "recruiter-1", tenantId: "tenant-1" }));
<<<<<<< ours
  const mockGetTenantScopedPrismaClient = vi.fn(async () => ({
    prisma: mockPrisma as any,
    tenantId: "tenant-1",
    runWithTenantContext: async <T>(callback: () => Promise<T>) => callback(),
  }));
=======
  const mockGetCurrentUser = vi.fn().mockResolvedValue({
    id: "user-1",
    tenantId: "tenant-1",
    role: "RECRUITER",
  });
>>>>>>> theirs

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

  return {
    mockAgentRunLogCreate,
    mockAgentRunLogUpdate,
    mockJobReqCreate,
    mockUserFindUnique,
    mockPrisma,
<<<<<<< ours
    mockGetTenantScopedPrismaClient,
=======
    mockGetCurrentUser,
>>>>>>> theirs
  };
});

const { mockCallLLM } = vi.hoisted(() => ({ mockCallLLM: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS" },
}));
vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  AGENT_KILL_SWITCHES: { RUA: "EAT-TS.RUA" },
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

    const request = new NextRequest(
      new Request("http://localhost/api/agents/intake", {
        method: "POST",
        body: JSON.stringify({ rawJobText: "A role" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await intakePost(request);

    expect(response.status).toBe(200);
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

    const request = new NextRequest(
      new Request("http://localhost/api/agents/intake", {
        method: "POST",
        body: JSON.stringify({ rawJobText: "bad" }),
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await intakePost(request);

    expect(response.status).toBe(500);
    expect(mockAgentRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

<<<<<<< ours
  it("blocks requests without a tenant", async () => {
    const { TenantScopeError } = await import("@/lib/agents/tenantScope");

    mockGetTenantScopedPrismaClient.mockRejectedValue(
      new TenantScopeError("Tenant is required", 400),
    );
=======
  it("denies access for unauthorized roles", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      tenantId: "tenant-1",
      role: "SALES",
    });
>>>>>>> theirs

    const request = new NextRequest(
      new Request("http://localhost/api/agents/intake", {
        method: "POST",
<<<<<<< ours
        body: JSON.stringify({ rawJobText: "bad" }),
=======
        body: JSON.stringify({ rawJobText: "A role" }),
>>>>>>> theirs
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await intakePost(request);

<<<<<<< ours
    expect(response.status).toBe(400);
=======
    expect(response.status).toBe(403);
    expect(mockAgentRunLogCreate).not.toHaveBeenCalled();
>>>>>>> theirs
  });
});
