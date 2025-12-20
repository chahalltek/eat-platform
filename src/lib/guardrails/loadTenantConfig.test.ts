import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultTenantGuardrails } from "./defaultTenantConfig";
import { loadTenantConfig } from "./loadTenantConfig";
import { resetTenantConfigSchemaFallbackForTests } from "@/lib/tenant/tenantConfigSchemaFallback";

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    tenantConfig: {
      findUnique: mockFindUnique,
    },
  },
}));

describe("loadTenantConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetTenantConfigSchemaFallbackForTests();
  });

  it("returns the stored config when the schema is migrated", async () => {
    mockFindUnique.mockResolvedValueOnce({
      preset: "balanced",
      scoring: { thresholds: { minMatchScore: 0.9, shortlistMinScore: 0.65, shortlistMaxCandidates: 5 } },
      explain: { includeWeights: true },
      safety: { confidenceBands: { medium: 0.62 } },
      llm: { model: "gpt-4o" },
      networkLearning: { enabled: true },
    });

    const result = await loadTenantConfig("tenant-123");

    expect(result).toMatchObject({
      preset: "balanced",
      scoring: {
        ...defaultTenantGuardrails.scoring,
        thresholds: { ...defaultTenantGuardrails.scoring.thresholds, minMatchScore: 0.9 },
      },
      explain: { ...defaultTenantGuardrails.explain, includeWeights: true },
      safety: {
        ...defaultTenantGuardrails.safety,
        confidenceBands: { ...defaultTenantGuardrails.safety.confidenceBands, medium: 0.62 },
      },
      llm: { ...defaultTenantGuardrails.llm, model: "gpt-4o" },
      networkLearning: { enabled: true },
      _source: "db",
    });
  });

  it("falls back to defaults when the preset column is missing", async () => {
    const missingColumnError = new Prisma.PrismaClientKnownRequestError(
      "Missing column preset",
      {
        code: "P2022",
        clientVersion: "5.19.0",
        meta: { column: "TenantConfig.preset" },
      },
    );

    mockFindUnique.mockRejectedValueOnce(missingColumnError);

    const result = await loadTenantConfig("tenant-123");

    expect(result).toMatchObject({
      ...defaultTenantGuardrails,
      preset: null,
      llm: {},
      networkLearning: { enabled: false },
      schemaMismatch: true,
      _source: "default",
    });
  });
});
