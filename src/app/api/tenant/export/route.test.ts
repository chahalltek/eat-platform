import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetCurrentTenantId = vi.hoisted(() => vi.fn());
const mockBuildTenantExportArchive = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: mockGetCurrentTenantId,
}));

vi.mock("@/lib/export/tenantExport", () => ({
  buildTenantExportArchive: mockBuildTenantExportArchive,
}));

import { POST } from "./route";

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

  const buildRequest = () => makeRequest({ method: "POST", url: "http://localhost/api/tenant/export" });

  it("blocks unauthenticated requests", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
    expect(mockBuildTenantExportArchive).not.toHaveBeenCalled();
  });

  it("blocks non-admin users", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "RECRUITER", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
    expect(mockBuildTenantExportArchive).not.toHaveBeenCalled();
  });

  it("prevents cross-tenant access even for admins", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-b");

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
    expect(mockBuildTenantExportArchive).not.toHaveBeenCalled();
  });

  it("returns a zip archive when authorized", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockBuildTenantExportArchive.mockResolvedValue({ archive: Buffer.from("zip-bytes") });

    const response = await POST(buildRequest());
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/zip");
    expect(buffer.toString()).toBe("zip-bytes");
    expect(mockBuildTenantExportArchive).toHaveBeenCalledWith("tenant-a");
  });

  it("handles export errors gracefully", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockBuildTenantExportArchive.mockRejectedValue(new Error("boom"));

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unable to generate export");
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
