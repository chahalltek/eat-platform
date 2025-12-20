import { describe, expect, it, vi } from "vitest";

import { TS_CONFIG } from "@/config/ts";
import { DEFAULT_GUARDRAILS, loadTenantGuardrailConfig } from "@/lib/guardrails/config";

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    guardrailConfig: {
      findUnique: mockFindUnique,
    },
    tenantConfig: {
      findFirst: mockFindFirst,
    },
  },
}));

describe("loadTenantGuardrailConfig", () => {
  it("returns defaults when no configuration is stored", async () => {
    mockFindUnique.mockResolvedValue(null);

    const config = await loadTenantGuardrailConfig("tenant-a");

    expect(config).toEqual({
      ...DEFAULT_GUARDRAILS,
      matcherMinScore: TS_CONFIG.matcher.minScore,
      shortlistMinScore: TS_CONFIG.shortlist.minMatchScore,
      shortlistMaxCandidates: TS_CONFIG.shortlist.topN,
      confidencePassingScore: TS_CONFIG.confidence.passingScore,
      source: "default",
    });
  });

  it("merges stored overrides with defaults", async () => {
    mockFindUnique.mockResolvedValue({
      matcherMinScore: 75,
      shortlistMaxCandidates: 2,
      explainLevel: "compact",
    });

    mockFindFirst.mockResolvedValue(null);

    const config = await loadTenantGuardrailConfig("tenant-b");

    expect(config.matcherMinScore).toBe(75);
    expect(config.shortlistMaxCandidates).toBe(2);
    expect(config.explainLevel).toBe("compact");
    expect(config.requireMustHaveSkills).toBe(DEFAULT_GUARDRAILS.requireMustHaveSkills);
    expect(config.source).toBe("database");
  });

  it("treats tenantConfig guardrails as database sourced", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue({ tenantId: "tenant-c" });

    const config = await loadTenantGuardrailConfig("tenant-c");

    expect(config.source).toBe("database");
  });
});
