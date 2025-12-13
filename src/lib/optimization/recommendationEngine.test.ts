/// <reference types="vitest/globals" />

import { OptimizationRecommendationEngine, optimizationRecommendationEngine } from "./recommendationEngine";

describe("OptimizationRecommendationEngine", () => {
  it("suggests threshold, strategy, and preset updates based on observed signals", async () => {
    const recommendations = await optimizationRecommendationEngine.generate("tenant-1", {
      mqiTrend: -6.2,
      guardrailAttribution: { preset: "performance", strategy: "aggressive", minMatchScore: 0.55 },
      falsePositiveRate: 0.32,
      confidenceDistribution: { low: 0.42, medium: 0.36, high: 0.22 },
      sampleSize: 120,
    });

    const ids = recommendations.map((entry) => entry.recommendationId);

    expect(ids).toContain("raise-min-match-score");
    expect(ids).toContain("rebalance-confidence-strategy");
    expect(ids).toContain("switch-to-balanced-preset");

    const threshold = recommendations.find((rec) => rec.recommendationId === "raise-min-match-score");
    expect(threshold?.suggestion).toContain("0.55");
    expect(threshold?.suggestion).toContain("0.6");
    expect(threshold?.rationale).toContain("false positive");
  });

  it("persists generated recommendations for later human review", async () => {
    const engine = new OptimizationRecommendationEngine();

    const first = await engine.generate("tenant-2", {
      mqiTrend: 0.4,
      guardrailAttribution: { preset: "balanced", strategy: "weighted", minMatchScore: 0.6 },
      falsePositiveRate: 0.08,
      confidenceDistribution: { low: 0.1, medium: 0.45, high: 0.45 },
      sampleSize: 45,
    });

    expect(first[0].confidence).toBe("low");

    const stored = await engine.list("tenant-2");
    expect(stored).toEqual(first);
  });

  it("remains read-only and only surfaces grounded recommendations", async () => {
    const engine = new OptimizationRecommendationEngine();

    const output = await engine.generate("tenant-3", {
      mqiTrend: -1,
      guardrailAttribution: { preset: "balanced", strategy: "weighted", minMatchScore: 0.62 },
      falsePositiveRate: 0.28,
      confidenceDistribution: { low: 0.2, medium: 0.35, high: 0.45 },
      sampleSize: 60,
    });

    expect(output).toHaveLength(1);
    expect(output[0].type).toBe("threshold");
    expect(output[0].suggestion).toContain("Increase minMatchScore");
    expect(output[0].rationale).toContain("false positive");

    const stored = await engine.list("tenant-3");
    expect(stored).toEqual(output);
  });
});
