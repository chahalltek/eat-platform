import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());
const mockLoadTenantMode = vi.hoisted(() => vi.fn());
const mockListFeatureFlags = vi.hoisted(() => vi.fn());
const mockLoadGuardrails = vi.hoisted(() => vi.fn());
const mockGetKillSwitchState = vi.hoisted(() => vi.fn());
const mockWithTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mockResolveTenantAccess,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: () => null,
}));

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: mockLoadTenantMode,
}));

vi.mock("@/lib/featureFlags", () => ({
  listFeatureFlags: mockListFeatureFlags,
}));

vi.mock("@/lib/tenant/guardrails", () => ({
  loadTenantGuardrailsWithSchemaStatus: mockLoadGuardrails,
  defaultTenantGuardrails: { matcherMinScore: 0.5 },
}));

vi.mock("@/lib/killSwitch", () => ({
  getKillSwitchState: mockGetKillSwitchState,
  KILL_SWITCHES: { AGENTS: "agents", SCORERS: "scorers", BUILDERS: "builders" },
}));

vi.mock("@/lib/tenant", () => ({
  withTenantContext: mockWithTenantContext,
}));

vi.mock("@/server/db/prisma", () => ({
  isPrismaUnavailableError: () => false,
}));

import { GET } from "./route";

describe("GET /api/admin/tenant/[tenantId]/runtime-controls", () => {
  const params = { params: Promise.resolve({ tenantId: "tenant-123" }) } as const;
  const request = makeRequest({ method: "GET", url: "http://localhost/api/admin/tenant/tenant-123/runtime-controls" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
    mockLoadTenantMode.mockResolvedValue({ mode: "pilot", source: "database" });
    mockWithTenantContext.mockImplementation((tenantId: string, callback: () => Promise<unknown>) => callback());
    mockListFeatureFlags.mockResolvedValue([{ name: "flag-a", enabled: true, updatedAt: new Date(), description: null }]);
    mockLoadGuardrails.mockResolvedValue({ guardrails: { matcherMinScore: 0.7 }, schemaStatus: { status: "ok" } });
    mockGetKillSwitchState.mockReturnValue({ latched: false });
  });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(request, params);

    expect(response.status).toBe(401);
    expect(mockLoadTenantMode).not.toHaveBeenCalled();
  });

  it("enforces tenant admin access", async () => {
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });

    const response = await GET(request, params);

    expect(response.status).toBe(403);
    expect(mockLoadTenantMode).not.toHaveBeenCalled();
  });

  it("returns runtime control details when authorized", async () => {
    const response = await GET(request, params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toEqual({ mode: "pilot", source: "database" });
    expect(body.featureFlags[0].name).toBe("flag-a");
    expect(body.guardrails.guardrails).toEqual({ matcherMinScore: 0.7 });
    expect(body.killSwitches).toEqual({
      agents: { latched: false },
      scorers: { latched: false },
      builders: { latched: false },
    });
    expect(body.warnings).toEqual([]);
  });

  it("returns warnings when feature flags are unavailable", async () => {
    mockListFeatureFlags.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("missing table", {
      code: "P2022",
      clientVersion: "1",
    }));

    const response = await GET(request, params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.featureFlags).toEqual([]);
    expect(body.warnings).toContain("Feature flags unavailable; using empty flag set.");
  });

  it("propagates guardrail fallback warnings", async () => {
    mockLoadGuardrails.mockResolvedValue({
      guardrails: { matcherMinScore: 0.5 },
      schemaStatus: { status: "fallback", reason: "TenantConfig table is missing", missingColumns: [] },
    });

    const response = await GET(request, params);
    const body = await response.json();

    expect(body.guardrails.schemaStatus.status).toBe("fallback");
    expect(body.warnings).toContain("TenantConfig table is missing");
  });
});
