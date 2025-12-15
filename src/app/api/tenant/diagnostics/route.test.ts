import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetCurrentTenantId = vi.hoisted(() => vi.fn());
const mockBuildTenantDiagnostics = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: mockGetCurrentTenantId,
}));

vi.mock("@/lib/tenant/diagnostics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenant/diagnostics")>("@/lib/tenant/diagnostics");

  return {
    ...actual,
    buildTenantDiagnostics: mockBuildTenantDiagnostics,
  };
});

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mockResolveTenantAccess,
}));

import { GET } from "./route";

describe("GET /api/tenant/diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });
  });

  const buildRequest = () => makeRequest({ method: "GET", url: "http://localhost/api/tenant/diagnostics" });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(mockBuildTenantDiagnostics).not.toHaveBeenCalled();
    expect(mockResolveTenantAccess).not.toHaveBeenCalled();
  });

  it("enforces admin access for the same tenant", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "RECRUITER", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });

    const response = await GET(buildRequest());

    expect(response.status).toBe(403);
    expect(mockBuildTenantDiagnostics).not.toHaveBeenCalled();
    expect(mockResolveTenantAccess).toHaveBeenCalledWith(
      {
        id: "user-1",
        role: "RECRUITER",
        tenantId: "tenant-a",
      },
      "tenant-a",
      { roleHint: null },
    );
  });

  it("prevents cross-tenant admin access", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-b");
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });

    const response = await GET(buildRequest());

    expect(response.status).toBe(403);
    expect(mockBuildTenantDiagnostics).not.toHaveBeenCalled();
    expect(mockResolveTenantAccess).toHaveBeenCalledWith(
      {
        id: "admin-1",
        role: "ADMIN",
        tenantId: "tenant-a",
      },
      "tenant-b",
      { roleHint: null },
    );
  });

  it("returns diagnostics when authorized", async () => {
    const payload = {
      tenantId: "tenant-a",
      mode: "pilot",
      modeNotice: null,
      sso: { configured: true, issuerUrl: "https://sso" },
      guardrailsPreset: "balanced",
      guardrailsRecommendation: "Guardrails customized from default values.",
      fireDrill: { enabled: false, fireDrillImpact: [], suggested: false, reason: null, windowMinutes: 30 },
      guardrailsStatus: "Guardrails healthy",
      configSchema: { status: "ok", missingColumns: [], reason: null },
      ats: { provider: "bullhorn", status: "ok", lastRunAt: null, nextAttemptAt: null, summary: null, errorMessage: null, retryCount: 0 },
    };
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockBuildTenantDiagnostics.mockResolvedValue(payload);
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: false, membership: { role: "ADMIN" } });

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(payload);
    expect(mockBuildTenantDiagnostics).toHaveBeenCalledWith("tenant-a");
  });

  it("maps missing tenants to 404", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    const { TenantNotFoundError } = await import("@/lib/tenant/diagnostics");
    mockBuildTenantDiagnostics.mockRejectedValue(new TenantNotFoundError("tenant-a"));
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: false, membership: { role: "ADMIN" } });

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("lets global admins bypass tenant membership", async () => {
    const payload = {
      tenantId: "tenant-b",
      mode: "pilot",
      modeNotice: null,
      fireDrill: { enabled: false, fireDrillImpact: [] },
      sso: { configured: true, issuerUrl: null },
      guardrailsStatus: "Guardrails healthy",
      configSchema: { status: "ok", missingColumns: [], reason: null },
    };
    mockGetCurrentUser.mockResolvedValue({ id: "sysadmin", role: "ADMIN", tenantId: "tenant-a" });
    mockGetCurrentTenantId.mockResolvedValue("tenant-b");
    mockBuildTenantDiagnostics.mockResolvedValue(payload);
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(payload);
    expect(mockResolveTenantAccess).toHaveBeenCalledWith(
      {
        id: "sysadmin",
        role: "ADMIN",
        tenantId: "tenant-a",
      },
      "tenant-b",
      { roleHint: null },
    );
  });
});

