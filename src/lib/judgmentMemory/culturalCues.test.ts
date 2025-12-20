import { describe, expect, it } from "vitest";

import type { JudgmentInsight } from "./insights";
import { buildDecisionCultureCues } from "./culturalCues";

const windowStart = new Date("2024-01-01T00:00:00Z");
const windowEnd = new Date("2024-01-15T00:00:00Z");

function buildInsight(overrides: Partial<JudgmentInsight> = {}): JudgmentInsight {
  const dimension = overrides.dimension ?? "client";
  const dimensionValue = overrides.dimensionValue ?? "client-123";
  const now = new Date("2024-01-20T00:00:00Z");
  const { metrics: metricOverrides, ...rest } = overrides;

  return {
    dimension,
    dimensionValue,
    windowStart,
    windowEnd,
    metrics: {
      decision_mix: {
        id: "mix-1",
        tenantId: "tenant-1",
        dimension,
        dimensionValue,
        windowStart,
        windowEnd,
        metric: "decision_mix",
        value: {
          mix: { submit: 10, override: 3, reject: 5, confidence_adjustment: 4 },
          total: 22,
        },
        sampleSize: 22,
        createdAt: now,
        updatedAt: now,
      },
      override_success_delta: {
        id: "override-1",
        tenantId: "tenant-1",
        dimension,
        dimensionValue,
        windowStart,
        windowEnd,
        metric: "override_success_delta",
        value: {
          delta: 0.12,
          baselineHireRate: 0.35,
          overrideHireRate: 0.48,
        },
        sampleSize: 16,
        createdAt: now,
        updatedAt: now,
      },
      confidence_band_success: {
        id: "band-1",
        tenantId: "tenant-1",
        dimension,
        dimensionValue,
        windowStart,
        windowEnd,
        metric: "confidence_band_success",
        value: {
          bands: {
            high: { hires: 7, total: 12, rate: 0.58 },
            medium: { hires: 3, total: 10, rate: 0.3 },
          },
        },
        sampleSize: 22,
        createdAt: now,
        updatedAt: now,
      },
      ...(metricOverrides ?? {}),
    },
    ...rest,
  };
}

describe("buildDecisionCultureCues", () => {
  it("builds contextual cues for a matching client", () => {
    const cues = buildDecisionCultureCues([buildInsight()], { clientId: "client-123" });

    expect(cues).toHaveLength(2);
    expect(cues[0].message).toContain("accepted higher rate risk");
    expect(cues[1].message).toContain("intake");
  });

  it("skips cues when context does not match", () => {
    const cues = buildDecisionCultureCues([buildInsight()], { clientId: "other-client" });

    expect(cues).toHaveLength(0);
  });

  it("requires meaningful sample sizes and normalization for role insights", () => {
    const now = new Date("2024-01-20T00:00:00Z");
    const insight = buildInsight({
      dimension: "role_type",
      dimensionValue: "data-engineer",
      metrics: {
        decision_mix: {
          id: "mix-role",
          tenantId: "tenant-1",
          dimension: "role_type",
          dimensionValue: "data-engineer",
          windowStart,
          windowEnd,
          metric: "decision_mix",
          value: { mix: { submit: 3, override: 1, reject: 2, confidence_adjustment: 1 }, total: 7 },
          sampleSize: 7,
          createdAt: now,
          updatedAt: now,
        },
        confidence_band_success: {
          id: "band-role",
          tenantId: "tenant-1",
          dimension: "role_type",
          dimensionValue: "data-engineer",
          windowStart,
          windowEnd,
          metric: "confidence_band_success",
          value: { bands: { high: { hires: 2, total: 4, rate: 0.5 } } },
          sampleSize: 4,
          createdAt: now,
          updatedAt: now,
        },
      },
    });

    const cues = buildDecisionCultureCues([insight], { roleType: "Data Engineer" });

    expect(cues).toHaveLength(1);
    expect(cues[0].scope).toBe("role_type");
  });
});
