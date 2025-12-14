import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLoadLatestAtsSync = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
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

describe("GET /api/admin/tenant/[tenantId]/ats-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });
  });

  const buildRequest = () =>
    makeRequest({ method: "GET", url: "http://localhost/api/admin/tenant/tenant-a/ats-sync" });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(buildRequest(), { params: Promise.resolve({ tenantId: "tenant-a" }) });

    expect(response.status).toBe(401);
    expect(mockLoadLatestAtsSync).not.toHaveBeenCalled();
  });

  it("enforces tenant or global admin access", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });

    const response = await GET(buildRequest(), { params: Promise.resolve({ tenantId: "tenant-a" }) });

    expect(response.status).toBe(403);
    expect(mockLoadLatestAtsSync).not.toHaveBeenCalled();
    expect(mockResolveTenantAccess).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "tenant-a", { roleHint: null });
  });

  it("returns the latest ATS sync when authorized", async () => {
    const payload = {
      provider: "bullhorn",
      status: "failed",
      lastRunAt: "2024-04-01T00:00:00.000Z",
      nextAttemptAt: "2024-04-01T01:00:00.000Z",
      errorMessage: "Webhook timeout",
      retryCount: 3,
      summary: { jobsSynced: 0, candidatesSynced: 1, placementsSynced: 0 },
    } as const;

    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
    mockLoadLatestAtsSync.mockResolvedValue(payload);

    const response = await GET(buildRequest(), { params: Promise.resolve({ tenantId: "tenant-a" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(payload);
    expect(mockLoadLatestAtsSync).toHaveBeenCalledWith("tenant-a");
  });

  it("maps errors to 500", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
    mockLoadLatestAtsSync.mockRejectedValue(new Error("boom"));

    const response = await GET(buildRequest(), { params: Promise.resolve({ tenantId: "tenant-a" }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Unable to load ATS sync run" });
    expect(consoleSpy).toHaveBeenCalledWith("Failed to fetch latest ATS sync run", expect.any(Error));

    consoleSpy.mockRestore();
  });
});
