import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guardrailsPresets } from "./presets";
import { loadTenantConfig } from "./tenantConfig";
import { resetTenantConfigSchemaFallbackForTests } from "@/lib/tenant/tenantConfigSchemaFallback";

const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    tenantConfig: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn(async () => "tenant-from-context"),
}));

describe("loadTenantConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetTenantConfigSchemaFallbackForTests();
  });

  it("falls back to balanced defaults when the preset column is missing", async () => {
    const missingColumnError = new Prisma.PrismaClientKnownRequestError("Missing column preset", {
      code: "P2022",
      clientVersion: "5.19.0",
      meta: { column: "TenantConfig.preset" },
    });

    mockFindFirst.mockRejectedValueOnce(missingColumnError);
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await loadTenantConfig("tenant-abc");

    expect(result).toEqual({
      scoring: guardrailsPresets.balanced.scoring,
      explain: guardrailsPresets.balanced.explain,
      safety: guardrailsPresets.balanced.safety,
      shortlist: guardrailsPresets.balanced.shortlist ?? {},
      llm: {},
      preset: null,
      networkLearning: { enabled: false },
      schemaMismatch: true,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "tenant_config_schema_mismatch",
        message:
          "TenantConfig column missing (TenantConfig.preset). Run prisma migrations to align the database schema.",
        tenantId: "tenant-abc",
      }),
    );
  });

  it("merges stored configuration with preset defaults", async () => {
    mockFindFirst.mockResolvedValue({
      tenantId: "tenant-xyz",
      preset: "aggressive",
      scoring: { thresholds: { minMatchScore: 99 } },
      explain: { level: "detailed" },
      safety: { requireMustHaves: false },
      llm: { provider: "openai", maxTokens: 123 },
      networkLearning: { enabled: true },
    });

    const result = await loadTenantConfig("tenant-xyz");

    expect(result.preset).toBe("aggressive");
    expect(result.scoring.thresholds.minMatchScore).toBe(99);
    expect(result.explain.level).toBe("detailed");
    expect(result.safety.requireMustHaves).toBe(false);
    expect(result.llm.maxTokens).toBe(123);
    expect(result.networkLearning.enabled).toBe(true);
    expect(result.schemaMismatch).toBe(false);
  });

  it("normalizes unknown presets and ignores non-object overrides", async () => {
    mockFindFirst.mockResolvedValue({
      tenantId: "tenant-unknown",
      preset: "not-a-preset",
      scoring: { thresholds: { shortlistMaxCandidates: 3 } },
      shortlist: "skip-me",
      llm: "not-an-object",
    });

    const result = await loadTenantConfig("tenant-unknown");

    expect(result.preset).toBeNull();
    expect(result.scoring.thresholds.shortlistMaxCandidates).toBe(3);
    expect(result.shortlist).toEqual(guardrailsPresets.balanced.shortlist ?? {});
    expect(result.llm).toEqual(guardrailsPresets.balanced.llm);
  });

  it("uses the current tenant id and deep merges nested objects", async () => {
    mockFindFirst.mockResolvedValue({
      scoring: { weights: { experience: 0.75 } },
      networkLearning: { enabled: true, metadata: { cohort: "beta" } },
      llm: { allowedAgents: ["CUSTOM"], verbosityCap: 1500 },
    });

    const result = await loadTenantConfig();

    expect(mockFindFirst).toHaveBeenCalledWith({ where: { tenantId: "tenant-from-context" } });
    expect(result.scoring.weights.experience).toBe(0.75);
    expect(result.networkLearning.enabled).toBe(true);
    expect(result.llm.allowedAgents).toEqual(["CUSTOM"]);
    expect(result.llm.verbosityCap).toBe(1500);
  });

  it("fills in missing preset sections with safe defaults", async () => {
    vi.resetModules();
    vi.doMock("./presets", () => ({
      guardrailsPresets: {
        balanced: {
          scoring: guardrailsPresets.balanced.scoring,
          explain: guardrailsPresets.balanced.explain,
          safety: guardrailsPresets.balanced.safety,
          // intentionally omit shortlist, llm, and networkLearning
        },
      },
    }));

    mockFindFirst.mockResolvedValue({});

    const { loadTenantConfig: loadWithMock } = await import("./tenantConfig");
    const result = await loadWithMock("tenant-missing-sections");

    expect(result.shortlist).toEqual({});
    expect(result.llm).toEqual({});
    expect(result.networkLearning).toEqual({ enabled: false });

    vi.resetModules();
  });
});
