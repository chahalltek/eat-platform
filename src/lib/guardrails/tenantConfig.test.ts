import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guardrailsPresets } from "./presets";
import { loadTenantConfig } from "./tenantConfig";

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
  });

  it("falls back to balanced defaults when the preset column is missing", async () => {
    const missingColumnError = new Prisma.PrismaClientKnownRequestError("Missing column preset", {
      code: "P2022",
      clientVersion: "5.19.0",
      meta: { column: "TenantConfig.preset" },
    });

    mockFindFirst.mockRejectedValueOnce(missingColumnError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
        event: "SCHEMA_MISMATCH",
        missingColumn: "TenantConfig.preset",
        tenantId: "tenant-abc",
      }),
    );
  });
});
