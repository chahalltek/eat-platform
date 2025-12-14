import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as agentRunPost } from "@/app/api/agents/agent/run/route";
import { GET as tenantDiagnosticsGet } from "@/app/api/tenant/diagnostics/route";
import { GET as jobIntentGet } from "@/app/api/jobs/[jobId]/intent/route";
import { createNextRouteTestServer } from "@tests/test-utils/nextRouteTestServer";

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

function buildJobIntentContext(jobId: string) {
  return {
    params: Promise.resolve({ jobId }),
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

    await request(server)
      .post("/api/agents/agent/run?agent=MVP.AGENT")
      .send({ payload: { foo: "bar" } })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true, result: { agentRunId: "run-123", result: { ok: true } }, traceId: "run-123" });
        expect(mocks.mockAgentHandler).toHaveBeenCalledWith({
          input: { payload: { foo: "bar" } },
          ctx: { currentUser: { id: "user-1", email: "u@example.com", displayName: "User", role: "USER" }, req: expect.anything() },
        });
      });

    server.close();
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

    await request(server)
      .get("/api/jobs/job-9/intent")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: "intent-1", jobReqId: "job-9", tenantId: "tenant-a" });
      });

    server.close();
  });

  it("returns diagnostics for authorized tenant admins", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: "admin-1" });
    mocks.mockResolveTenantAdminAccess.mockResolvedValue({ hasAccess: true });
    mocks.mockBuildTenantDiagnostics.mockResolvedValue({ tenantId: "tenant-a", featureFlags: { enabled: true, enabledFlags: [] } });

    const server = createNextRouteTestServer(tenantDiagnosticsGet);

    await request(server)
      .get("/api/tenant/diagnostics")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ tenantId: "tenant-a", featureFlags: { enabled: true } });
      });

    server.close();
  });
});
