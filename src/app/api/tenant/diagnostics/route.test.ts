import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetCurrentTenantId = vi.hoisted(() => vi.fn());
const mockBuildTenantDiagnostics = vi.hoisted(() => vi.fn());
const MockNotFoundError = vi.hoisted(() => class extends Error {});

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: mockGetCurrentTenantId,
}));

vi.mock("@/lib/tenant/diagnostics", () => ({
  buildTenantDiagnostics: mockBuildTenantDiagnostics,
  TenantNotFoundError: MockNotFoundError,
}));

import { GET } from "./route";

describe("GET /api/tenant/diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const buildRequest = () => new NextRequest("http://localhost/api/tenant/diagnostics");

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(mockBuildTenantDiagnostics).not.toHaveBeenCalled();
  });

  it("enforces admin access for the same tenant", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "RECRUITER", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");

    const response = await GET(buildRequest());

    expect(response.status).toBe(403);
    expect(mockBuildTenantDiagnostics).not.toHaveBeenCalled();
  });

  it("prevents cross-tenant admin access", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-b");

    const response = await GET(buildRequest());

    expect(response.status).toBe(403);
    expect(mockBuildTenantDiagnostics).not.toHaveBeenCalled();
  });

  it("returns diagnostics when authorized", async () => {
    const payload = { tenantId: "tenant-a", sso: { configured: true, issuerUrl: "https://sso" } };
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockBuildTenantDiagnostics.mockResolvedValue(payload);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(payload);
    expect(mockBuildTenantDiagnostics).toHaveBeenCalledWith("tenant-a");
  });

  it("maps missing tenants to 404", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockBuildTenantDiagnostics.mockRejectedValue(new MockNotFoundError());

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });
});

