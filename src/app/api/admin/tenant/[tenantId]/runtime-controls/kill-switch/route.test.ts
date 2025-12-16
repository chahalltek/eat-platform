import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());
const mockCanManageTenants = vi.hoisted(() => vi.fn());
const mockLatchKillSwitch = vi.hoisted(() => vi.fn());
const mockResetKillSwitch = vi.hoisted(() => vi.fn());
const mockGetKillSwitchState = vi.hoisted(() => vi.fn());
const mockLogKillSwitchToggle = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  tenant: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mockResolveTenantAccess,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: () => null,
}));

vi.mock("@/lib/auth/permissions", () => ({
  canManageTenants: mockCanManageTenants,
}));

vi.mock("@/lib/killSwitch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/killSwitch")>("@/lib/killSwitch");

  return {
    ...actual,
    latchKillSwitch: mockLatchKillSwitch,
    resetKillSwitch: mockResetKillSwitch,
    getKillSwitchState: mockGetKillSwitchState,
  };
});

vi.mock("@/lib/audit/adminAudit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/adminAudit")>("@/lib/audit/adminAudit");

  return {
    ...actual,
    logKillSwitchToggle: mockLogKillSwitchToggle,
  };
});

vi.mock("@/server/db", () => ({
  prisma: prismaMock,
}));

import { KILL_SWITCHES } from "@/lib/killSwitch";

import { POST } from "./route";

describe("POST /api/admin/tenant/[tenantId]/runtime-controls/kill-switch", () => {
  const buildRequest = (options: { body?: BodyInit | null; json?: unknown } = {}) =>
    makeRequest({
      method: "POST",
      url: "http://localhost/api/admin/tenant/tenant-a/runtime-controls/kill-switch",
      ...options,
    });
  const params = { params: Promise.resolve({ tenantId: "tenant-a" }) } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tenant.findUnique.mockResolvedValue({ id: "tenant-a" });
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });
    mockCanManageTenants.mockReturnValue(false);
    mockLatchKillSwitch.mockReturnValue({
      latched: true,
      reason: "manual",
      latchedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    mockGetKillSwitchState.mockReturnValue({ latched: false });
  });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(buildRequest(), params);

    expect(response.status).toBe(401);
    expect(mockLatchKillSwitch).not.toHaveBeenCalled();
    expect(mockResetKillSwitch).not.toHaveBeenCalled();
  });

  it("enforces tenant admin access", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });

    const response = await POST(buildRequest({ json: { key: KILL_SWITCHES.SCORERS, latched: true } }), params);

    expect(response.status).toBe(403);
    expect(mockResolveTenantAccess).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "tenant-a", { roleHint: null });
    expect(mockLatchKillSwitch).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);

    const response = await POST(buildRequest({ body: "{", headers: { "content-type": "application/json" } }), params);

    expect(response.status).toBe(400);
  });

  it("validates payloads", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);

    const response = await POST(buildRequest({ json: { key: "unknown", latched: "yes" } }), params);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "key and latched are required" });
  });

  it("returns 404 for missing tenants", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    const response = await POST(buildRequest({ json: { key: KILL_SWITCHES.SCORERS, latched: true } }), params);

    expect(response.status).toBe(404);
  });

  it("latches kill switches with reasons", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);

    const response = await POST(
      buildRequest({ json: { key: KILL_SWITCHES.SCORERS, latched: true, reason: "panic" } }),
      params,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLatchKillSwitch).toHaveBeenCalledWith(KILL_SWITCHES.SCORERS, "panic");
    expect(body).toEqual({
      key: KILL_SWITCHES.SCORERS,
      label: "Scorers",
      state: {
        latched: true,
        reason: "manual",
        latchedAt: "2024-01-01T00:00:00.000Z",
      },
    });
    expect(mockLogKillSwitchToggle).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorId: "admin-1",
      key: KILL_SWITCHES.SCORERS,
      latched: true,
      reason: "manual",
      latchedAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("unlatches kill switches", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);
    mockGetKillSwitchState.mockReturnValueOnce({ latched: false });

    const response = await POST(buildRequest({ json: { key: KILL_SWITCHES.BUILDERS, latched: false } }), params);

    expect(response.status).toBe(200);
    expect(mockResetKillSwitch).toHaveBeenCalledWith(KILL_SWITCHES.BUILDERS);
    expect(mockLogKillSwitchToggle).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorId: "admin-1",
      key: KILL_SWITCHES.BUILDERS,
      latched: false,
      reason: null,
      latchedAt: null,
    });
  });
});
