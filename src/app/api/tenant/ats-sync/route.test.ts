import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetCurrentTenantId = vi.hoisted(() => vi.fn());
const mockLoadLatestAtsSync = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: mockGetCurrentTenantId,
  getTenantFromParamsOrSession: (requested: string | null, sessionTenantId: string | null) =>
    requested ?? sessionTenantId ?? "",
}));

vi.mock("@/lib/tenant/diagnostics", () => ({
  loadLatestAtsSync: mockLoadLatestAtsSync,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mockResolveTenantAccess,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: () => null,
}));

import { GET } from "./route";

describe("GET /api/tenant/ats-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });
  });

  const buildRequest = () => makeRequest({ method: "GET", url: "http://localhost/api/tenant/ats-sync" });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(mockLoadLatestAtsSync).not.toHaveBeenCalled();
    expect(mockResolveTenantAccess).not.toHaveBeenCalled();
  });

  it("enforces admin access for the tenant", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "USER", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");

    const response = await GET(buildRequest());

    expect(response.status).toBe(403);
    expect(mockLoadLatestAtsSync).not.toHaveBeenCalled();
    expect(mockResolveTenantAccess).toHaveBeenCalledWith(
      { id: "user-1", role: "USER", tenantId: "tenant-a" },
      "tenant-a",
      { roleHint: null },
    );
  });

  it("returns the latest ATS sync when authorized", async () => {
    const payload = {
      provider: "bullhorn",
      status: "success",
      lastRunAt: "2024-05-01T00:00:00.000Z",
      nextAttemptAt: null,
      errorMessage: null,
      retryCount: 0,
      summary: { jobsSynced: 10, candidatesSynced: 5, placementsSynced: 1 },
    } as const;

    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockLoadLatestAtsSync.mockResolvedValue(payload);
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: false, membership: { role: "ADMIN" } });

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(payload);
    expect(mockLoadLatestAtsSync).toHaveBeenCalledWith("tenant-a");
  });

  it("maps errors to 500", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: false, membership: { role: "ADMIN" } });
    mockLoadLatestAtsSync.mockRejectedValue(new Error("boom"));

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Unable to load ATS sync run" });
    expect(consoleSpy).toHaveBeenCalledWith("Failed to fetch latest ATS sync run", expect.any(Error));

    consoleSpy.mockRestore();
  });
});
