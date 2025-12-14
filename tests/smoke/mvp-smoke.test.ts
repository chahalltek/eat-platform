import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as agentRunPost } from "@/app/api/agents/agent/run/route";
import { GET as tenantDiagnosticsGet } from "@/app/api/tenant/diagnostics/route";
import { GET as jobIntentGet } from "@/app/api/jobs/[jobReqId]/intent/route";
import { createNextRouteTestServer } from "@tests/test-utils/nextRouteTestServer";
import { withListeningServer } from "@tests/test-utils/serverHelpers";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockResolveTenantAdminAccess: vi.fn(),
  mockBuildTenantDiagnostics: vi.fn(),
  mockRequireRecruiterOrAdmin: vi.fn(),
  mockGetTenantScopedPrismaClient: vi.fn(),
  mockAgentHandler: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mocks.mockGetCurrentUser }));
vi.mock("@/lib/tenant/access", () => ({ resolveTenantAdminAccess: mocks.mockResolveTenantAdminAccess }));
vi.mock("@/lib/tenant/diagnostics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenant/diagnostics")>("@/lib/tenant/diagnostics");

  return {
    ...actual,
    buildTenantDiagnostics: mocks.mockBuildTenantDiagnostics,
  };
});
vi.mock("@/lib/tenant", () => ({ getCurrentTenantId: vi.fn().mockResolvedValue("tenant-a") }));
vi.mock("@/lib/tenant/roles", () => ({ getTenantRoleFromHeaders: vi.fn().mockReturnValue(null) }));
vi.mock("@/lib/auth/requireRole", () => ({ requireRecruiterOrAdmin: mocks.mockRequireRecruiterOrAdmin }));
vi.mock("@/lib/agents/tenantScope", () => ({
  getTenantScopedPrismaClient: mocks.mockGetTenantScopedPrismaClient,
  toTenantErrorResponse: () => null,
}));
vi.mock("@/server/agents/registry", () => ({
  AgentRegistry: {
    "MVP.AGENT": {
      key: "MVP.AGENT",
      displayName: "MVP Agent",
      description: "Test agent for MVP routing",
      run: mocks.mockAgentHandler,
    },
  },
}));

function buildJobIntentContext(jobReqId: string) {
  return {
    params: Promise.resolve({ jobReqId }),
  } satisfies any;
}

describe("MVP smoke tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("runs agent dispatcher for MVP agent", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "u@example.com", displayName: "User", role: "USER" });
    mocks.mockAgentHandler.mockResolvedValue({ agentRunId: "run-123", result: { ok: true } });

    const server = createNextRouteTestServer(agentRunPost);

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agents/agent/run?agent=MVP.AGENT`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: { foo: "bar" } }),
      });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual({ ok: true, result: { agentRunId: "run-123", result: { ok: true } }, traceId: "run-123" });
      expect(mocks.mockAgentHandler).toHaveBeenCalledWith({
        input: { payload: { foo: "bar" } },
        ctx: { currentUser: { id: "user-1", email: "u@example.com", displayName: "User", role: "USER" }, req: expect.anything() },
      });
    });
  });

  it("reads a tenant-scoped job intent", async () => {
    mocks.mockRequireRecruiterOrAdmin.mockResolvedValue({ ok: true, response: null });
    mocks.mockGetTenantScopedPrismaClient.mockResolvedValue({
      prisma: { jobIntent: { findFirst: vi.fn().mockResolvedValue({ id: "intent-1", tenantId: "tenant-a", jobReqId: "job-9" }) } },
      tenantId: "tenant-a",
    });

    const server = createNextRouteTestServer(jobIntentGet, {
      buildContext: () => buildJobIntentContext("job-9"),
    });

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs/job-9/intent`);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toMatchObject({ id: "intent-1", jobReqId: "job-9", tenantId: "tenant-a" });
    });
  });

  it("returns diagnostics for authorized tenant admins", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: "admin-1" });
    mocks.mockResolveTenantAdminAccess.mockResolvedValue({ hasAccess: true });
    mocks.mockBuildTenantDiagnostics.mockResolvedValue({ tenantId: "tenant-a", featureFlags: { enabled: true, enabledFlags: [] } });

    const server = createNextRouteTestServer(tenantDiagnosticsGet);

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tenant/diagnostics`);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toMatchObject({ tenantId: "tenant-a", featureFlags: { enabled: true } });
    });
  });
});
