import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { USER_ROLES } from "@/lib/auth/roles";

vi.mock("@/lib/auth/requireRole", () => ({
  requireAdminOrDataAccess: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn(),
}));

vi.mock("@/lib/export/tenantExport", () => ({
  buildTenantExportArchive: vi.fn(),
}));

type RequireRoleResult = Awaited<ReturnType<typeof import("@/lib/auth/requireRole")["requireAdminOrDataAccess"]>>;

function makeRequest() {
  const url = new URL("http://localhost/api/tenant/export");
  const request = new Request(url, { method: "POST" });
  return new NextRequest(request);
}

describe("POST /api/tenant/export", () => {
  const originalEnv = {
    SECURITY_MODE: process.env.SECURITY_MODE,
    DATA_EXPORTS_ENABLED: process.env.DATA_EXPORTS_ENABLED,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECURITY_MODE = "internal";
    process.env.DATA_EXPORTS_ENABLED = "true";
  });

  afterEach(() => {
    process.env.SECURITY_MODE = originalEnv.SECURITY_MODE;

    if (originalEnv.DATA_EXPORTS_ENABLED === undefined) {
      delete process.env.DATA_EXPORTS_ENABLED;
    } else {
      process.env.DATA_EXPORTS_ENABLED = originalEnv.DATA_EXPORTS_ENABLED;
    }
  });

  it("returns the role check response when the user is not authorized", async () => {
    const forbiddenResponse = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { requireAdminOrDataAccess } = await import("@/lib/auth/requireRole");

    vi.mocked(requireAdminOrDataAccess).mockResolvedValue({ ok: false, response: forbiddenResponse });

    const response = await POST(makeRequest());

    expect(response).toBe(forbiddenResponse);
  });

  it("enforces tenant isolation for data access users", async () => {
    const { requireAdminOrDataAccess } = await import("@/lib/auth/requireRole");
    const { getCurrentTenantId } = await import("@/lib/tenant");

    vi.mocked(requireAdminOrDataAccess).mockResolvedValue({
      ok: true,
      user: { id: "user-1", role: USER_ROLES.DATA_ACCESS, tenantId: "tenant-1" },
    } as RequireRoleResult);
    vi.mocked(getCurrentTenantId).mockResolvedValue("tenant-2");

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
  });

  it("returns a tenant archive when authorized", async () => {
    const { requireAdminOrDataAccess } = await import("@/lib/auth/requireRole");
    const { getCurrentTenantId } = await import("@/lib/tenant");
    const { buildTenantExportArchive } = await import("@/lib/export/tenantExport");

    vi.mocked(requireAdminOrDataAccess).mockResolvedValue({
      ok: true,
      user: { id: "user-1", role: USER_ROLES.DATA_ACCESS, tenantId: "tenant-1" },
    } as RequireRoleResult);
    vi.mocked(getCurrentTenantId).mockResolvedValue("tenant-1");
    vi.mocked(buildTenantExportArchive).mockResolvedValue({ archive: new ArrayBuffer(1) });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/zip");
  });

  it("blocks exports when outbound data is disabled", async () => {
    process.env.SECURITY_MODE = "preview";
    delete process.env.DATA_EXPORTS_ENABLED;
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Data exports is disabled");
    expect(mockBuildTenantExportArchive).not.toHaveBeenCalled();
  });
});
