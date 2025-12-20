import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());
const mockSetFeatureFlag = vi.hoisted(() => vi.fn());
const mockCanManageFeatureFlags = vi.hoisted(() => vi.fn());
const mockLogFeatureFlagToggle = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/featureFlags", async () => {
  const actual = await vi.importActual<typeof import("@/lib/featureFlags")>("@/lib/featureFlags");

  return {
    ...actual,
    setFeatureFlag: mockSetFeatureFlag,
  };
});

vi.mock("@/lib/audit/adminAudit", () => ({
  logFeatureFlagToggle: mockLogFeatureFlagToggle,
}));

vi.mock("@/lib/auth/permissions", () => ({
  canManageFeatureFlags: mockCanManageFeatureFlags,
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: prismaMock,
}));

import { POST } from "./route";

describe("POST /api/admin/tenant/[tenantId]/runtime-controls/feature-flags", () => {
  const buildRequest = (options: { body?: BodyInit | null; json?: unknown } = {}) =>
    makeRequest({
      method: "POST",
      url: "http://localhost/api/admin/tenant/tenant-a/runtime-controls/feature-flags",
      ...options,
    });
  const params = { params: Promise.resolve({ tenantId: "tenant-a" }) } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tenant.findUnique.mockResolvedValue({ id: "tenant-a" });
    mockCanManageFeatureFlags.mockReturnValue(false);
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });
    mockSetFeatureFlag.mockResolvedValue({
      name: "scoring",
      description: "",
      enabled: true,
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
  });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(buildRequest(), params);

    expect(response.status).toBe(401);
    expect(mockSetFeatureFlag).not.toHaveBeenCalled();
  });

  it("enforces tenant admin access when the caller cannot manage all feature flags", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });

    const response = await POST(buildRequest({ json: { flagKey: "scoring", enabled: true } }), params);

    expect(response.status).toBe(403);
    expect(mockResolveTenantAccess).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "tenant-a", { roleHint: null });
    expect(mockSetFeatureFlag).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON bodies", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageFeatureFlags.mockReturnValue(true);

    const response = await POST(
      buildRequest({ body: "{", headers: { "content-type": "application/json" } }),
      params,
    );

    expect(response.status).toBe(400);
    expect(mockSetFeatureFlag).not.toHaveBeenCalled();
  });

  it("validates feature flag payloads", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageFeatureFlags.mockReturnValue(true);

    const response = await POST(buildRequest({ json: { flagKey: "", enabled: "yes" } }), params);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "flagKey and enabled are required" });
  });

  it("rejects unsupported scopes", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageFeatureFlags.mockReturnValue(true);

    const response = await POST(buildRequest({ json: { flagKey: "scoring", enabled: true, scope: "global" } }), params);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Only tenant scope is supported" });
    expect(mockSetFeatureFlag).not.toHaveBeenCalled();
  });

  it("returns 404 when the tenant does not exist", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageFeatureFlags.mockReturnValue(true);
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    const response = await POST(buildRequest({ json: { flagKey: "scoring", enabled: true } }), params);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Tenant not found" });
  });

  it("updates feature flags for authorized callers", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockCanManageFeatureFlags.mockReturnValue(true);

    const response = await POST(buildRequest({ json: { flagKey: "scoring", enabled: true } }), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      flagKey: "scoring",
      description: "",
      enabled: true,
      scope: "tenant",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(mockSetFeatureFlag).toHaveBeenCalledWith("scoring", true, "tenant-a");
    expect(mockLogFeatureFlagToggle).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      actorId: "admin-1",
      flagKey: "scoring",
      enabled: true,
      scope: "tenant",
    });
  });
});
