import { describe, expect, it, vi, beforeEach } from "vitest";

import { TenantDeletionMode } from "@prisma/client";

import { buildTenantDiagnostics, TenantNotFoundError } from "./diagnostics";

const mockGetAppConfig = vi.hoisted(() => vi.fn());
const mockGetTenantPlan = vi.hoisted(() => vi.fn());
const mockGetRateLimitDefaults = vi.hoisted(() => vi.fn());
const mockGetRateLimitOverrides = vi.hoisted(() => vi.fn());
const mockIsFeatureEnabledForTenant = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  securityEventLog: { count: vi.fn() },
}));

vi.mock("@/lib/config/configValidator", () => ({
  getAppConfig: mockGetAppConfig,
}));

vi.mock("@/lib/subscriptionPlans", () => ({
  getTenantPlan: mockGetTenantPlan,
}));

vi.mock("@/lib/rateLimiting/rateLimiter", () => ({
  getRateLimitDefaults: mockGetRateLimitDefaults,
  getRateLimitPlanOverrides: mockGetRateLimitOverrides,
}));

vi.mock("@/lib/featureFlags", () => ({
  isFeatureEnabledForTenant: mockIsFeatureEnabledForTenant,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("buildTenantDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRateLimitDefaults.mockReturnValue({
      api: { dailyLimit: 100, burstLimit: 10, burstWindowMs: 60000, bucket: "tenant" },
    });
    mockGetRateLimitOverrides.mockReturnValue({ api: { dailyLimit: 200 } });
    mockIsFeatureEnabledForTenant.mockResolvedValue(true);
    prismaMock.securityEventLog.count.mockResolvedValue(5);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: "tenant-a",
      dataRetentionDays: 45,
      deletionMode: TenantDeletionMode.SOFT_DELETE,
    });
    mockGetAppConfig.mockReturnValue({
      SSO_ISSUER_URL: "https://sso.example.com",
      SSO_CLIENT_ID: "client-id",
      SSO_CLIENT_SECRET: "secret",
    });
    mockGetTenantPlan.mockResolvedValue({
      plan: { id: "plan-basic", name: "Basic", limits: { rateLimits: { api: { dailyLimit: 200 } } } },
      subscription: { isTrial: true, endAt: new Date("2024-02-01T00:00:00.000Z") },
    });
  });

  it("summarizes tenant readiness state", async () => {
    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.sso.configured).toBe(true);
    expect(diagnostics.plan).toEqual({
      id: "plan-basic",
      name: "Basic",
      isTrial: true,
      trialEndsAt: "2024-02-01T00:00:00.000Z",
      limits: { rateLimits: { api: { dailyLimit: 200 } } },
    });
    expect(diagnostics.auditLogging).toEqual({ enabled: true, eventsRecorded: 5 });
    expect(diagnostics.dataExport.enabled).toBe(true);
    expect(diagnostics.retention).toEqual({ configured: true, days: 45, mode: TenantDeletionMode.SOFT_DELETE });
    expect(diagnostics.rateLimits).toEqual([
      {
        action: "api",
        default: { dailyLimit: 100, burstLimit: 10, burstWindowMs: 60000, bucket: "tenant" },
        override: { dailyLimit: 200 },
      },
    ]);
    expect(diagnostics.featureFlags.enabledFlags.length).toBeGreaterThan(0);
    expect(mockIsFeatureEnabledForTenant).toHaveBeenCalledTimes(3);
  });

  it("handles missing optional features gracefully", async () => {
    mockGetAppConfig.mockReturnValue({});
    mockGetTenantPlan.mockResolvedValue(null);
    mockGetRateLimitOverrides.mockReturnValue(null);
    mockIsFeatureEnabledForTenant.mockResolvedValue(false);
    prismaMock.securityEventLog.count.mockResolvedValue(0);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: "tenant-b",
      dataRetentionDays: null,
      deletionMode: TenantDeletionMode.HARD_DELETE,
    });

    const diagnostics = await buildTenantDiagnostics("tenant-b");

    expect(diagnostics.sso.configured).toBe(false);
    expect(diagnostics.plan).toEqual({ id: null, name: null, isTrial: false, trialEndsAt: null, limits: null });
    expect(diagnostics.auditLogging).toEqual({ enabled: false, eventsRecorded: 0 });
    expect(diagnostics.retention).toEqual({ configured: false, days: null, mode: null });
    expect(diagnostics.featureFlags).toEqual({ enabled: false, enabledFlags: [] });
    expect(diagnostics.rateLimits[0].override).toBeNull();
  });

  it("treats audit logging as disabled when counting fails", async () => {
    prismaMock.securityEventLog.count.mockRejectedValue(new Error("boom"));

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.auditLogging).toEqual({ enabled: false, eventsRecorded: 0 });
  });

  it("throws when tenant is missing", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    await expect(buildTenantDiagnostics("missing"))
      .rejects.toBeInstanceOf(TenantNotFoundError);
  });
});

