import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { POST as intakePost } from "@/app/api/agents/intake/route";
import { expectApiError } from "@/test-helpers/api";
import {
  makeNextRequest,
  mockGetCurrentTenantContext,
  mockGetCurrentUser as createMockGetCurrentUser,
  prisma,
  resetDbMocks,
} from "@tests/helpers";

const mockAgentRunLogCreate = vi.hoisted(() =>
  vi.fn(async ({ data }) => ({ id: "run-1", ...data })),
);
const mockAgentRunLogUpdate = vi.hoisted(() =>
  vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
);
const mockJobReqCreate = vi.hoisted(() => vi.fn(async ({ data }) => ({ id: "job-1", ...data })));
const mockUserFindUnique = vi.hoisted(() => vi.fn(async () => ({ id: "recruiter-1", tenantId: "tenant-1" })));
const mockGetTenantScopedPrismaClient = vi.hoisted(() => vi.fn());
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockRequireRole = vi.hoisted(() => vi.fn());

const { mockCallLLM } = vi.hoisted(() => ({ mockCallLLM: vi.fn() }));
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
  assertFeatureEnabled: vi.fn().mockResolvedValue(null),
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
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockRecordMetricEvent }));
vi.mock("@/lib/auth/requireRole", () => ({
  requireRole: mockRequireRole,
  requireRecruiterOrAdmin: vi.fn(),
  requireHiringManagerOrAdmin: vi.fn(),
}));

describe("INTAKE agent API", () => {
  beforeEach(() => {
    resetDbMocks();
    prisma.agentRunLog.create.mockImplementation(mockAgentRunLogCreate);
    prisma.agentRunLog.update.mockImplementation(mockAgentRunLogUpdate);
    prisma.jobReq.create.mockImplementation(mockJobReqCreate);
    prisma.user.findUnique.mockImplementation(mockUserFindUnique);
    mockGetTenantScopedPrismaClient.mockImplementation(
      mockGetCurrentTenantContext({ tenantId: "tenant-1" }),
    );
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      role: "RECRUITER",
      email: null,
      displayName: null,
    });
    mockRecordMetricEvent.mockResolvedValue(undefined);
    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: "user-1", tenantId: "tenant-1", role: "RECRUITER" },
    });
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

    const request = makeNextRequest({
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
    expect(mockRecordMetricEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        eventType: "DECISION_STREAM_ITEM",
        entityId: "job-1",
        meta: expect.objectContaining({
          action: "INTAKE_RESULT",
          jobId: "job-1",
          skillsCount: 1,
          status: "Open",
        }),
      }),
    );
  });

  it("marks failed runs when parsing fails", async () => {
    mockCallLLM.mockResolvedValue("not-json");

    const request = makeNextRequest({
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
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    });

    const request = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/agents/intake",
      json: { rawJobText: "A role" },
    });

    const response = await intakePost(request);

    await expectApiError(response, 403);
    expect(mockAgentRunLogCreate).not.toHaveBeenCalled();
  });
});
