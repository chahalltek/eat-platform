import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guardrailsPresets } from "./presets";
import { loadTenantConfig } from "./tenantConfig";
import { resetTenantConfigSchemaFallbackForTests } from "@/lib/tenant/tenantConfigSchemaFallback";

const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
}));

vi.mock("@/server/db", () => ({
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
      llm: guardrailsPresets.balanced.llm ?? {},
      preset: null,
      networkLearning: { enabled: Boolean(guardrailsPresets.balanced.networkLearning?.enabled) },
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "tenant_config_schema_mismatch",
        message:
          "TenantConfig column missing (likely preset). Run prisma migrations to align the database schema.",
        tenantId: "tenant-abc",
      }),
    );
  });
});
