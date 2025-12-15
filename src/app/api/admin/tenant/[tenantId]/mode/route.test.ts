import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());
const mockUpdateTenantMode = vi.hoisted(() => vi.fn());
const mockCanManageTenants = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/tenantMode", () => ({
  updateTenantMode: mockUpdateTenantMode,
}));

vi.mock("@/lib/auth/permissions", () => ({
  canManageTenants: mockCanManageTenants,
}));

vi.mock("@/server/db", () => ({
  prisma: prismaMock,
}));

import { POST } from "./route";

describe("POST /api/admin/tenant/[tenantId]/mode", () => {
  const buildRequest = (options: { body?: BodyInit | null; json?: unknown } = {}) =>
    makeRequest({ method: "POST", url: "http://localhost/api/admin/tenant/tenant-a/mode", ...options });
  const params = { params: Promise.resolve({ tenantId: "tenant-a" }) } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tenant.findUnique.mockResolvedValue({ id: "tenant-a" });
    mockCanManageTenants.mockReturnValue(false);
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });
    mockUpdateTenantMode.mockResolvedValue({ id: "tenant-a", name: "Tenant A", mode: "pilot" });
  });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(buildRequest(), params);

    expect(response.status).toBe(401);
    expect(mockUpdateTenantMode).not.toHaveBeenCalled();
  });

  it("enforces tenant admin access when the caller is not a platform admin", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });

    const response = await POST(buildRequest({ json: { mode: "pilot" } }), params);

    expect(response.status).toBe(403);
    expect(mockResolveTenantAccess).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "tenant-a", { roleHint: null });
    expect(mockUpdateTenantMode).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON bodies", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);

    const response = await POST(
      buildRequest({ body: "{", headers: { "content-type": "application/json" } }),
      params,
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTenantMode).not.toHaveBeenCalled();
  });

  it("validates the requested mode", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);

    const response = await POST(buildRequest({ json: { mode: "unknown" } }), params);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "mode is required" });
  });

  it("returns 404 when the tenant does not exist", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    const response = await POST(buildRequest({ json: { mode: "pilot" } }), params);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Tenant not found" });
  });

  it("updates the tenant mode for authorized callers", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageTenants.mockReturnValue(true);

    const response = await POST(buildRequest({ json: { mode: "pilot" } }), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ tenant: { id: "tenant-a", name: "Tenant A", mode: "pilot" } });
    expect(mockUpdateTenantMode).toHaveBeenCalledWith("tenant-a", "pilot");
  });
});
