import { describe, expect, it, vi, beforeEach } from "vitest";

import { TenantDeletionMode } from "@prisma/client";

import { buildTenantDiagnostics, TenantNotFoundError } from "./diagnostics";
import { FEATURE_FLAGS } from "@/lib/featureFlags/constants";

const mockGetAppConfig = vi.hoisted(() => vi.fn());
const mockGetTenantPlan = vi.hoisted(() => vi.fn());
const mockGetRateLimitDefaults = vi.hoisted(() => vi.fn());
const mockGetRateLimitOverrides = vi.hoisted(() => vi.fn());
const mockIsFeatureEnabledForTenant = vi.hoisted(() => vi.fn());
const mockLoadGuardrails = vi.hoisted(() => vi.fn());
const mockGetSystemMode = vi.hoisted(() => vi.fn());
const mockGetSystemMode = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  securityEventLog: { count: vi.fn() },
  agentRunLog: { count: vi.fn() },
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

vi.mock("@/lib/systemMode", () => ({
  getSystemMode: mockGetSystemMode,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/guardrails/config", () => ({
  loadTenantGuardrailConfig: mockLoadGuardrails,
}));

describe("buildTenantDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRateLimitDefaults.mockReturnValue({
      api: { dailyLimit: 100, burstLimit: 10, burstWindowMs: 60000, bucket: "tenant" },
    });
    mockGetRateLimitOverrides.mockReturnValue({ api: { dailyLimit: 200 } });
    mockIsFeatureEnabledForTenant.mockImplementation(async (_tenantId, name) => name !== FEATURE_FLAGS.FIRE_DRILL_MODE);
    mockLoadGuardrails.mockResolvedValue({
      matcherMinScore: 70,
      shortlistMinScore: 65,
      shortlistMaxCandidates: 3,
      requireMustHaveSkills: true,
      explainLevel: "compact",
      confidencePassingScore: 70,
      source: "database",
    });
    prismaMock.securityEventLog.count.mockResolvedValue(5);
    prismaMock.agentRunLog.count.mockResolvedValue(0);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: "tenant-a",
      dataRetentionDays: 45,
      deletionMode: TenantDeletionMode.SOFT_DELETE,
    });
    mockGetAppConfig.mockReturnValue({
      SSO_ISSUER_URL: "https://sso.example.com",
      SSO_CLIENT_ID: "client-id",
      SSO_CLIENT_SECRET: "secret",
      SYSTEM_MODE: "pilot",
    });
    mockGetTenantPlan.mockResolvedValue({
      plan: {
        id: "plan-basic",
        name: "Basic",
        limits: { rateLimits: { api: { dailyLimit: 200 } }, guardrailsPreset: "balanced" },
      },
      subscription: { isTrial: true, endAt: new Date("2024-02-01T00:00:00.000Z") },
    });
    mockGetSystemMode.mockReturnValue({ mode: "pilot", fireDrill: { enabled: false, fireDrillImpact: [] } });
  });

  it("summarizes tenant readiness state", async () => {
    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.sso.configured).toBe(true);
    expect(diagnostics.guardrailsPreset).toBe("balanced");
    expect(diagnostics.guardrailsRecommendation).toBe("Guardrails customized from default values.");
    expect(diagnostics.mode).toBe("pilot");
    expect(diagnostics.fireDrill).toEqual({
      enabled: false,
      fireDrillImpact: [],
      suggested: false,
      reason: null,
      windowMinutes: 30,
    });
    expect(diagnostics.plan).toEqual({
      id: "plan-basic",
      name: "Basic",
      isTrial: true,
      trialEndsAt: "2024-02-01T00:00:00.000Z",
      limits: { rateLimits: { api: { dailyLimit: 200 } }, guardrailsPreset: "balanced" },
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
    expect(diagnostics.guardrails).toEqual({
      matcherMinScore: 70,
      shortlistMinScore: 65,
      shortlistMaxCandidates: 3,
      requireMustHaveSkills: true,
      explainLevel: "compact",
      confidencePassingScore: 70,
      source: "database",
    });
    const expectedFlags = Object.values(FEATURE_FLAGS).filter(
      (flag) => flag !== FEATURE_FLAGS.FIRE_DRILL_MODE,
    );

    expect(diagnostics.featureFlags.enabled).toBe(true);
    expect(diagnostics.featureFlags.enabledFlags).toEqual(expectedFlags);
    expect(diagnostics.fireDrill).toEqual({
      enabled: false,
      fireDrillImpact: [],
      suggested: false,
      reason: null,
      windowMinutes: 30,
    });
  });

  it("handles missing optional features gracefully", async () => {
    mockGetAppConfig.mockReturnValue({});
    mockGetTenantPlan.mockResolvedValue(null);
    mockGetRateLimitOverrides.mockReturnValue(null);
    mockIsFeatureEnabledForTenant.mockResolvedValue(false);
    mockLoadGuardrails.mockResolvedValue({
      matcherMinScore: 60,
      shortlistMinScore: 60,
      shortlistMaxCandidates: 5,
      requireMustHaveSkills: false,
      explainLevel: "detailed",
      confidencePassingScore: 60,
      source: "default",
    });
    prismaMock.securityEventLog.count.mockResolvedValue(0);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: "tenant-b",
      dataRetentionDays: null,
      deletionMode: TenantDeletionMode.HARD_DELETE,
    });
    mockGetSystemMode.mockReturnValue({ mode: "sandbox", fireDrill: { enabled: false, fireDrillImpact: [] } });

    const diagnostics = await buildTenantDiagnostics("tenant-b");

    expect(diagnostics.mode).toBe("sandbox");
    expect(diagnostics.sso.configured).toBe(false);
    expect(diagnostics.guardrailsPreset).toBeNull();
    expect(diagnostics.guardrailsRecommendation).toBe("Consider using a preset (balanced) to simplify tuning.");
    expect(diagnostics.plan).toEqual({ id: null, name: null, isTrial: false, trialEndsAt: null, limits: null });
    expect(diagnostics.auditLogging).toEqual({ enabled: false, eventsRecorded: 0 });
    expect(diagnostics.retention).toEqual({ configured: false, days: null, mode: null });
    expect(diagnostics.featureFlags).toEqual({ enabled: false, enabledFlags: [] });
    expect(diagnostics.rateLimits[0].override).toBeNull();
    expect(diagnostics.guardrails.source).toBe("default");
  });

  it("includes fire drill status when enabled", async () => {
    mockGetSystemMode.mockReturnValue({
      mode: "fire_drill",
      fireDrill: { enabled: true, fireDrillImpact: ["Agent dispatch paused", "Guardrails forced to conservative"] },
    });

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.mode).toBe("fire_drill");
    expect(diagnostics.fireDrill.fireDrillImpact).toEqual([
      "Agent dispatch paused",
      "Guardrails forced to conservative",
    ]);
    expect(diagnostics.fireDrill.suggested).toBe(false);
  });

  it("treats audit logging as disabled when counting fails", async () => {
    prismaMock.securityEventLog.count.mockRejectedValue(new Error("boom"));

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.auditLogging).toEqual({ enabled: false, eventsRecorded: 0 });
    expect(diagnostics.fireDrill.enabled).toBe(false);
  });

  it("throws when tenant is missing", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    await expect(buildTenantDiagnostics("missing"))
      .rejects.toBeInstanceOf(TenantNotFoundError);
  });
});

