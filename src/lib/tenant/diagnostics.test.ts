import { describe, expect, it, vi, beforeEach } from "vitest";

import { AgentRunStatus, TenantDeletionMode } from "@/server/db/prisma";

import { buildTenantDiagnostics, TenantNotFoundError } from "./diagnostics";
import { FEATURE_FLAGS } from "@/lib/featureFlags/constants";

const mockGetAppConfig = vi.hoisted(() => vi.fn());
const mockGetTenantPlan = vi.hoisted(() => vi.fn());
const mockGetRateLimitDefaults = vi.hoisted(() => vi.fn());
const mockGetRateLimitOverrides = vi.hoisted(() => vi.fn());
const mockIsFeatureEnabledForTenant = vi.hoisted(() => vi.fn());
const mockLoadGuardrails = vi.hoisted(() => vi.fn());
const mockLoadTenantMode = vi.hoisted(() => vi.fn());
const mockLoadTenantGuardrails = vi.hoisted(() => vi.fn());
const mockLoadTenantGuardrailsWithSchemaStatus = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  securityEventLog: { count: vi.fn() },
  agentRunLog: { count: vi.fn(), findFirst: vi.fn() },
  $queryRaw: vi.fn(),
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

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: mockLoadTenantMode,
}));

vi.mock("@/server/db/prisma", async (importOriginal) => {
  const previousAllowConstruction = process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION;
  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = "true";

  const actual = await importOriginal<typeof import("@/server/db/prisma")>();

  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = previousAllowConstruction;

  return {
    ...actual,
    AgentRunStatus:
      actual.AgentRunStatus ??
      (actual as any).Prisma?.AgentRunStatus ?? {
        RUNNING: "RUNNING",
        SUCCESS: "SUCCESS",
        FAILED: "FAILED",
        PARTIAL: "PARTIAL",
      },
    TenantDeletionMode:
      actual.TenantDeletionMode ??
      (actual as any).Prisma?.TenantDeletionMode ?? {
        HARD_DELETE: "HARD_DELETE",
        SOFT_DELETE: "SOFT_DELETE",
      },
    prisma: prismaMock,
    isPrismaUnavailableError: () => false,
  };
});

vi.mock("@/lib/guardrails/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/guardrails/config")>();

  return {
    ...actual,
    loadTenantGuardrailConfig: mockLoadGuardrails,
  };
});

vi.mock("@/lib/tenant/guardrails", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant/guardrails")>();

  return {
    ...actual,
    loadTenantGuardrails: mockLoadTenantGuardrails,
    loadTenantGuardrailsWithSchemaStatus: mockLoadTenantGuardrailsWithSchemaStatus,
  };
});

describe("buildTenantDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
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
    mockLoadTenantGuardrails.mockResolvedValue({
      llm: {
        provider: "openai",
        model: "gpt-4.1-mini",
        allowedAgents: ["EXPLAIN", "RINA", "RUA"],
        maxTokens: 600,
        verbosityCap: 2000,
      },
    });
    mockLoadTenantGuardrailsWithSchemaStatus.mockResolvedValue({
      guardrails: {
        llm: {
          provider: "openai",
          model: "gpt-4.1-mini",
          allowedAgents: ["EXPLAIN", "RINA", "RUA"],
          maxTokens: 600,
          verbosityCap: 2000,
        },
      },
      schemaStatus: { status: "ok", missingColumns: [], reason: null },
    });
    prismaMock.$queryRaw.mockResolvedValue([
      { column_name: "preset" },
      { column_name: "llm" },
      { column_name: "networkLearningOptIn" },
      { column_name: "networkLearning" },
    ]);
    prismaMock.securityEventLog.count.mockResolvedValue(5);
    prismaMock.agentRunLog.count.mockResolvedValue(0);
    prismaMock.agentRunLog.findFirst.mockResolvedValue(null);
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
    mockLoadTenantMode.mockResolvedValue({
      mode: "pilot",
      guardrailsPreset: "balanced",
      agentsEnabled: [],
      source: "database",
    });
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
    expect(diagnostics.configSchema).toEqual({ status: "ok", missingColumns: [], reason: null });
    expect(diagnostics.schemaDrift).toEqual({ status: "ok", missingColumns: [], reason: null });
    expect(diagnostics.llm).toEqual({
      provider: "openai",
      model: "gpt-4.1-mini",
      allowedAgents: ["EXPLAIN", "RINA", "RUA"],
      status: "ready",
      reason: null,
      maxTokens: 600,
      verbosityCap: 2000,
      fireDrillOverride: false,
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
    expect(diagnostics.ats.status).toBe("unknown");
  });

  it("maps the latest ATS sync run into diagnostics", async () => {
    prismaMock.agentRunLog.findFirst.mockResolvedValue({
      agentName: "ATS_SYNC.BULLHORN",
      status: "FAILED",
      startedAt: new Date("2024-03-01T00:00:00Z"),
      finishedAt: new Date("2024-03-01T00:03:00Z"),
      errorMessage: "Webhook timeout",
      retryCount: 2,
      retryPayload: { nextAttemptAt: "2024-03-01T00:05:00.000Z" },
      outputSnapshot: { jobsSynced: 0, candidatesSynced: 1, placementsSynced: 0 },
    });

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.ats).toEqual({
      provider: "bullhorn",
      status: "failed",
      lastRunAt: "2024-03-01T00:03:00.000Z",
      nextAttemptAt: "2024-03-01T00:05:00.000Z",
      errorMessage: "Webhook timeout",
      retryCount: 2,
      summary: { jobsSynced: 0, candidatesSynced: 1, placementsSynced: 0 },
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
    mockLoadTenantGuardrails.mockResolvedValue({
      llm: {
        provider: "disabled",
        model: "gpt-4.1-mini",
        allowedAgents: ["EXPLAIN"],
        maxTokens: undefined,
        verbosityCap: undefined,
      },
    });
    mockLoadTenantGuardrailsWithSchemaStatus.mockResolvedValue({
      guardrails: {
        llm: {
          provider: "disabled",
          model: "gpt-4.1-mini",
          allowedAgents: ["EXPLAIN"],
          maxTokens: undefined,
          verbosityCap: undefined,
        },
      },
      schemaStatus: { status: "ok", missingColumns: [], reason: null },
    });
    prismaMock.securityEventLog.count.mockResolvedValue(0);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: "tenant-b",
      dataRetentionDays: null,
      deletionMode: TenantDeletionMode.HARD_DELETE,
    });
    mockLoadTenantMode.mockResolvedValue({
      mode: "sandbox",
      guardrailsPreset: "balanced",
      agentsEnabled: [],
      source: "database",
    });

    const diagnostics = await buildTenantDiagnostics("tenant-b");

    expect(diagnostics.mode).toBe("sandbox");
    expect(diagnostics.sso.configured).toBe(false);
    expect(diagnostics.guardrailsPreset).toBe("custom");
    expect(diagnostics.guardrailsRecommendation).toBe('Use a preset and treat "custom" as explicit overrides.');
    expect(diagnostics.plan).toEqual({ id: null, name: null, isTrial: false, trialEndsAt: null, limits: null });
    expect(diagnostics.auditLogging).toEqual({ enabled: false, eventsRecorded: 0 });
    expect(diagnostics.retention).toEqual({ configured: false, days: null, mode: null });
    expect(diagnostics.fireDrill).toEqual({
      enabled: false,
      fireDrillImpact: [],
      suggested: false,
      reason: null,
      windowMinutes: 30,
    });
    expect(diagnostics.featureFlags).toEqual({ enabled: false, enabledFlags: [] });
    expect(diagnostics.rateLimits[0].override).toBeNull();
    expect(diagnostics.guardrails.source).toBe("default");
    expect(diagnostics.llm.status).toBe("disabled");
  });

  it("surfaces config schema mismatches when guardrails fall back", async () => {
    mockLoadTenantGuardrailsWithSchemaStatus.mockResolvedValue({
      guardrails: {
        llm: {
          provider: "disabled",
          model: "gpt-4.1-mini",
          allowedAgents: ["EXPLAIN"],
        },
      },
      schemaStatus: { status: "fallback", missingColumns: ["preset", "networkLearning"], reason: null },
    });

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.configSchema).toEqual({
      status: "fallback",
      missingColumns: ["preset", "networkLearning"],
      reason: "Missing columns: preset, networkLearning",
    });
    expect(diagnostics.llm.status).toBe("disabled");
  });

  it("flags schema drift when TenantConfig columns are missing", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ column_name: "preset" }]);

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.schemaDrift).toEqual({
      status: "fault",
      missingColumns: ["llm", "networkLearningOptIn", "networkLearning", "brandName", "brandLogoUrl", "brandLogoAlt"],
      reason: "Missing columns: llm, networkLearningOptIn, networkLearning, brandName, brandLogoUrl, brandLogoAlt",
    });
  });

  it("treats schema drift probes as faults when the inspection fails", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("offline"));

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.schemaDrift.status).toBe("fault");
    expect(diagnostics.schemaDrift.missingColumns).toEqual([
      "preset",
      "llm",
      "networkLearningOptIn",
      "networkLearning",
      "brandName",
      "brandLogoUrl",
      "brandLogoAlt",
    ]);
    expect(diagnostics.schemaDrift.reason).toContain("could not be inspected");
  });

  it("prefers tenant config rows when present", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: "tenant-c",
      dataRetentionDays: 30,
      deletionMode: TenantDeletionMode.SOFT_DELETE,
      config: [{ preset: "aggressive", mode: "sandbox" }],
    });
    mockLoadTenantMode.mockResolvedValue({
      mode: "pilot",
      guardrailsPreset: "balanced",
      agentsEnabled: [],
      source: "database",
    });

    const diagnostics = await buildTenantDiagnostics("tenant-c");

    expect(diagnostics.guardrailsPreset).toBe("aggressive");
    expect(diagnostics.mode).toBe("sandbox");
  });

  it("recovers when optional subsystems fail", async () => {
    mockGetAppConfig.mockImplementation(() => {
      throw new Error("no config");
    });
    mockGetTenantPlan.mockRejectedValue(new Error("plan unavailable"));
    mockIsFeatureEnabledForTenant.mockRejectedValue(new Error("flags offline"));
    mockLoadGuardrails.mockRejectedValue(new Error("guardrails table missing"));
    mockLoadTenantGuardrails.mockRejectedValue(new Error("guardrails unavailable"));
    mockLoadTenantGuardrailsWithSchemaStatus.mockRejectedValue(new Error("guardrails unavailable"));

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.plan).toEqual({ id: null, name: null, isTrial: false, trialEndsAt: null, limits: null });
    expect(diagnostics.featureFlags).toEqual({ enabled: false, enabledFlags: [] });
    expect(diagnostics.guardrails.source).toBe("default");
    expect(diagnostics.configSchema.status).toBe("fallback");
    expect(diagnostics.llm).toMatchObject({ status: "ready", fireDrillOverride: false });
  });

  it("includes fire drill status when enabled", async () => {
    mockIsFeatureEnabledForTenant.mockResolvedValue(true);
    mockLoadTenantMode.mockResolvedValue({
      mode: "fire_drill",
      guardrailsPreset: "conservative",
      agentsEnabled: [],
      source: "database",
    });

    const diagnostics = await buildTenantDiagnostics("tenant-a");

    expect(diagnostics.mode).toBe("fire_drill");
    expect(diagnostics.fireDrill.enabled).toBe(true);
    expect(diagnostics.fireDrill.windowMinutes).toBe(30);
    expect(diagnostics.fireDrill.fireDrillImpact).toEqual([
      "Agent dispatch paused",
      "Guardrails forced to conservative",
    ]);
    expect(diagnostics.fireDrill.suggested).toBe(false);
    expect(diagnostics.fireDrill.reason).toBeNull();
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
