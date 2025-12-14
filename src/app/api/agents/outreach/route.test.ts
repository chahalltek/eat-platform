import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  agentFeatureGuard: vi.fn(),
  runOutreach: vi.fn(),
  getCurrentTenantId: vi.fn(),
  enforceAgentKillSwitch: vi.fn(),
  validateRecruiterId: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/featureFlags/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/featureFlags/middleware")>();

  return { ...actual, agentFeatureGuard: mocks.agentFeatureGuard };
});
vi.mock("@/lib/agents/outreach", () => ({ runOutreach: mocks.runOutreach }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenantId: mocks.getCurrentTenantId }));
vi.mock("@/lib/agents/killSwitch", () => ({
  AGENT_KILL_SWITCHES: { OUTREACH: "OUTREACH" },
  enforceAgentKillSwitch: mocks.enforceAgentKillSwitch,
}));
vi.mock("../recruiterValidation", () => ({ validateRecruiterId: mocks.validateRecruiterId }));
vi.mock("@/lib/rateLimiting/http", () => ({ toRateLimitResponse: vi.fn() }));
vi.mock("@/lib/rateLimiting/rateLimiter", () => ({ isRateLimitError: vi.fn(() => false) }));

import { POST } from "./route";

describe("POST /api/agents/outreach", () => {
  const originalEnv = {
    SECURITY_MODE: process.env.SECURITY_MODE,
    OUTBOUND_EMAIL_ENABLED: process.env.OUTBOUND_EMAIL_ENABLED,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agentFeatureGuard.mockResolvedValue(null);
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "ADMIN", tenantId: "tenant-1" });
    mocks.getCurrentTenantId.mockResolvedValue("tenant-1");
    mocks.enforceAgentKillSwitch.mockResolvedValue(null);
    mocks.validateRecruiterId.mockResolvedValue({ recruiterId: "user-1" });
    process.env.SECURITY_MODE = "internal";
    process.env.OUTBOUND_EMAIL_ENABLED = "true";
  });

  afterEach(() => {
    process.env.SECURITY_MODE = originalEnv.SECURITY_MODE;

    if (originalEnv.OUTBOUND_EMAIL_ENABLED === undefined) {
      delete process.env.OUTBOUND_EMAIL_ENABLED;
    } else {
      process.env.OUTBOUND_EMAIL_ENABLED = originalEnv.OUTBOUND_EMAIL_ENABLED;
    }
  });

  it("blocks outbound email attempts in preview mode", async () => {
    process.env.SECURITY_MODE = "preview";
    delete process.env.OUTBOUND_EMAIL_ENABLED;

    const response = await POST(
      new Request("http://localhost/api/agents/outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recruiterId: "user-1", candidateId: "cand-1", jobReqId: "job-1" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Outbound email is disabled");
    expect(mocks.runOutreach).not.toHaveBeenCalled();
  });
});
