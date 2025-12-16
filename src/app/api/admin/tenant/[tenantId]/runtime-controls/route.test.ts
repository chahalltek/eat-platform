import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockRequireGlobalOrTenantAdmin = vi.hoisted(() => vi.fn());
const mockLoadTenantMode = vi.hoisted(() => vi.fn());
const mockListFeatureFlags = vi.hoisted(() => vi.fn());
const mockLoadGuardrails = vi.hoisted(() => vi.fn());
const mockGetKillSwitchState = vi.hoisted(() => vi.fn());
const mockWithTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/requireGlobalOrTenantAdmin", () => ({
  requireGlobalOrTenantAdmin: mockRequireGlobalOrTenantAdmin,
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

vi.mock("@/server/db", () => ({
  isPrismaUnavailableError: () => false,
}));

import { GET } from "./route";

describe("GET /api/admin/tenant/[tenantId]/runtime-controls", () => {
  const params = { params: Promise.resolve({ tenantId: "tenant-123" }) } as const;
  const request = makeRequest({ method: "GET", url: "http://localhost/api/admin/tenant/tenant-123/runtime-controls" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireGlobalOrTenantAdmin.mockResolvedValue({
      ok: true,
      user: { id: "user-1" },
      access: { actorId: "user-1", isGlobalAdmin: false, tenantId: "tenant-123", membershipRole: "admin" },
    });
    mockLoadTenantMode.mockResolvedValue({ mode: "pilot", source: "database" });
    mockWithTenantContext.mockImplementation((tenantId: string, callback: () => Promise<unknown>) => callback());
    mockListFeatureFlags.mockResolvedValue([{ name: "flag-a", enabled: true, updatedAt: new Date(), description: null }]);
    mockLoadGuardrails.mockResolvedValue({ guardrails: { matcherMinScore: 0.7 }, schemaStatus: { status: "ok" } });
    mockGetKillSwitchState.mockReturnValue({ latched: false });
  });

  it("enforces tenant admin access", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireGlobalOrTenantAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const response = await GET(request, params);

    expect(response).toBe(forbidden);
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
