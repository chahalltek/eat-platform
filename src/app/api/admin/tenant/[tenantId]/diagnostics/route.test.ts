import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockBuildTenantDiagnostics = vi.hoisted(() => vi.fn());
const MockNotFoundError = vi.hoisted(() => class extends Error {});
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/tenant/diagnostics", () => ({
  buildTenantDiagnostics: mockBuildTenantDiagnostics,
  TenantNotFoundError: MockNotFoundError,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mockResolveTenantAccess,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: () => null,
}));

import { GET } from "./route";

describe("GET /api/admin/tenant/[tenantId]/diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });
  });

  const buildRequest = () =>
    makeRequest({ method: "GET", url: "http://localhost/api/admin/tenant/tenant-a/diagnostics" });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(buildRequest(), { params: Promise.resolve({ tenantId: "tenant-a" }) });

    expect(response.status).toBe(401);
    expect(mockBuildTenantDiagnostics).not.toHaveBeenCalled();
  });

  it("enforces tenant or global admin access", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });

    const response = await GET(buildRequest(), { params: Promise.resolve({ tenantId: "tenant-a" }) });

    expect(response.status).toBe(403);
    expect(mockBuildTenantDiagnostics).not.toHaveBeenCalled();
    expect(mockResolveTenantAccess).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "tenant-a", { roleHint: null });
  });

  it("returns diagnostics for authorized callers", async () => {
    const payload = {
      tenantId: "tenant-a",
      mode: "pilot",
      modeNotice: null,
      fireDrill: { enabled: false, fireDrillImpact: [] },
      guardrailsStatus: "Guardrails healthy",
      sso: { configured: true, issuerUrl: null },
    };
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
    mockBuildTenantDiagnostics.mockResolvedValue(payload);

    const response = await GET(buildRequest(), { params: Promise.resolve({ tenantId: "tenant-a" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(payload);
    expect(mockBuildTenantDiagnostics).toHaveBeenCalledWith("tenant-a");
  });

  it("maps missing tenants to 404", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
    mockBuildTenantDiagnostics.mockRejectedValue(new MockNotFoundError());

    const response = await GET(buildRequest(), { params: Promise.resolve({ tenantId: "tenant-a" }) });

    expect(response.status).toBe(404);
  });
});
