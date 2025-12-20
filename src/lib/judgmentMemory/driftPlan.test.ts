import { describe, expect, it } from "vitest";

import type { JudgmentInsight } from "./insights";
import { buildDriftPlan } from "./driftPlan";

const baseInsight: JudgmentInsight = {
  dimension: "role_type",
  dimensionValue: "data-engineer",
  windowStart: new Date("2024-11-01T00:00:00Z"),
  windowEnd: new Date("2024-12-31T23:59:59Z"),
  metrics: {},
};

function withMetrics(metrics: JudgmentInsight["metrics"]): JudgmentInsight {
  return { ...baseInsight, metrics };
}

describe("buildDriftPlan", () => {
  it("creates default, tradeoff, and confidence drift adjustments when signals are strong", () => {
    const insight = withMetrics({
      decision_mix: { value: { total: 32, mix: { submit: 22, override: 6, reject: 4 } }, sampleSize: 32 } as any,
      hire_rate: { value: { rate: 0.62, hires: 20, decisions: 32 }, sampleSize: 32 } as any,
      override_rate: { value: { rate: 0.19, overrides: 6, total: 32 }, sampleSize: 32 } as any,
      override_success_delta: {
        value: { delta: 0.18, overrideHireRate: 0.71, baselineHireRate: 0.53, overrideRate: 0.19 },
        sampleSize: 12,
      } as any,
      confidence_band_success: {
        value: {
          bands: {
            high: { hires: 14, total: 18, rate: 0.78 },
            medium: { hires: 4, total: 10, rate: 0.4 },
            low: { hires: 0, total: 4, rate: 0 },
          },
        },
        sampleSize: 32,
      } as any,
    });

    const plan = buildDriftPlan([insight]);
    const categories = plan.map((item) => item.category);

    expect(plan).toHaveLength(3);
    expect(categories).toEqual(expect.arrayContaining(["defaults", "tradeoffs", "confidence"]));
    expect(plan.every((item) => item.status === "applied")).toBe(true);
  });

  it("keeps adjustments in watch mode when sample sizes are small", () => {
    const insight = withMetrics({
      decision_mix: { value: { total: 6, mix: { submit: 4, override: 1, reject: 1 } }, sampleSize: 6 } as any,
      hire_rate: { value: { rate: 0.67, hires: 4, decisions: 6 }, sampleSize: 6 } as any,
      override_success_delta: {
        value: { delta: 0.12, overrideHireRate: 1, baselineHireRate: 0.5, overrideRate: 0.17 },
        sampleSize: 2,
      } as any,
      confidence_band_success: {
        value: { bands: { high: { hires: 2, total: 3, rate: 0.67 } } },
        sampleSize: 3,
      } as any,
    });

    const plan = buildDriftPlan([insight]);
    expect(plan).not.toHaveLength(0);
    expect(plan.every((item) => item.status === "watching")).toBe(true);
  });
});
