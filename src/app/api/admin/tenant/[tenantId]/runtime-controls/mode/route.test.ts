import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());
const mockIsRuntimeControlsWriteEnabled = vi.hoisted(() => vi.fn());
const mockLoadRuntimeControlMode = vi.hoisted(() => vi.fn());
const mockPersistRuntimeControlMode = vi.hoisted(() => vi.fn());
const mockLogModeChange = vi.hoisted(() => vi.fn());
const mockLogRuntimeModeChanged = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/runtimeControls/mode", () => ({
  isRuntimeControlsWriteEnabled: mockIsRuntimeControlsWriteEnabled,
  loadRuntimeControlMode: mockLoadRuntimeControlMode,
  persistRuntimeControlMode: mockPersistRuntimeControlMode,
}));

vi.mock("@/lib/audit/adminAudit", () => ({
  logModeChange: mockLogModeChange,
}));

vi.mock("@/lib/audit/securityEvents", () => ({
  logRuntimeModeChanged: mockLogRuntimeModeChanged,
}));

vi.mock("@/server/db", () => ({
  prisma: prismaMock,
}));

import { POST } from "./route";

const buildRequest = (options: { body?: BodyInit | null; json?: unknown } = {}) =>
  makeRequest({
    method: "POST",
    url: "http://localhost/api/admin/tenant/tenant-123/runtime-controls/mode",
    ...options,
  });

const params = { params: Promise.resolve({ tenantId: "tenant-123" }) } as const;

describe("POST /api/admin/tenant/[tenantId]/runtime-controls/mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRuntimeControlsWriteEnabled.mockReturnValue(true);
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
    mockLoadRuntimeControlMode.mockResolvedValue({ mode: "pilot", source: "database" });
    mockPersistRuntimeControlMode.mockResolvedValue({
      id: "tenant-123",
      name: "Tenant 123",
      mode: "production",
      source: "database",
    });
    prismaMock.tenant.findUnique.mockResolvedValue({ id: "tenant-123", name: "Tenant 123" });
  });

  it("rejects unauthorized callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(buildRequest({ json: { mode: "pilot" } }), params);

    expect(response.status).toBe(401);
    expect(mockPersistRuntimeControlMode).not.toHaveBeenCalled();
  });

  it("enforces tenant admin access", async () => {
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });

    const response = await POST(buildRequest({ json: { mode: "pilot" } }), params);

    expect(response.status).toBe(403);
    expect(mockPersistRuntimeControlMode).not.toHaveBeenCalled();
  });

  it("returns 403 when writes are disabled", async () => {
    mockIsRuntimeControlsWriteEnabled.mockReturnValue(false);

    const response = await POST(buildRequest({ json: { mode: "pilot" } }), params);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Runtime controls have READ-only rights in this environment" });
    expect(mockPersistRuntimeControlMode).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON bodies", async () => {
    const response = await POST(
      buildRequest({ body: "{", headers: { "content-type": "application/json" } }),
      params,
    );

    expect(response.status).toBe(400);
    expect(mockPersistRuntimeControlMode).not.toHaveBeenCalled();
  });

  it("validates the requested mode", async () => {
    const response = await POST(buildRequest({ json: { mode: "unknown" } }), params);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "mode is required" });
  });

  it("returns 404 when the tenant does not exist", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    const response = await POST(buildRequest({ json: { mode: "pilot" } }), params);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Tenant not found" });
  });

  it("persists mode changes and logs updates", async () => {
    const response = await POST(buildRequest({ json: { mode: "production" } }), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      tenant: {
        id: "tenant-123",
        name: "Tenant 123",
        mode: "production",
        source: "database",
      },
    });
    expect(mockPersistRuntimeControlMode).toHaveBeenCalledWith({ id: "tenant-123", name: "Tenant 123" }, "production");
    expect(mockLogModeChange).toHaveBeenCalledWith({
      tenantId: "tenant-123",
      actorId: "admin-1",
      previousMode: "pilot",
      newMode: "production",
    });
    expect(mockLogRuntimeModeChanged).toHaveBeenCalledWith({
      tenantId: "tenant-123",
      userId: "admin-1",
      previousMode: "pilot",
      newMode: "production",
      source: "database",
    });
  });
});
