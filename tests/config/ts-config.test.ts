import { describe, expect, it } from "vitest";

import { TS_CONFIG } from "@/lib/config/tsConfig";

const EPSILON = 1e-3;

describe("TS configuration", () => {
  it("has matcher weights and thresholds in valid ranges", () => {
    const { matcher } = TS_CONFIG;

    expect(matcher.minScore).toBeGreaterThanOrEqual(0);
    expect(matcher.minScore).toBeLessThanOrEqual(100);

    const weightValues = Object.values(matcher.weights);

    weightValues.forEach((weight) => {
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
    });

    const totalWeight = weightValues.reduce((sum, weight) => sum + weight, 0);
    expect(totalWeight).toBeGreaterThanOrEqual(1 - EPSILON);
    expect(totalWeight).toBeLessThanOrEqual(1 + EPSILON);
  });

  it("enforces shortlist safeguards", () => {
    const { shortlist } = TS_CONFIG;

    expect(shortlist.minMatchScore).toBeGreaterThanOrEqual(0);
    expect(shortlist.minMatchScore).toBeLessThanOrEqual(100);
    expect(shortlist.minConfidence).toBeGreaterThanOrEqual(0);
    expect(shortlist.minConfidence).toBeLessThanOrEqual(100);
    expect(Number.isInteger(shortlist.topN)).toBe(true);
    expect(shortlist.topN).toBeGreaterThan(0);
  });

  it("requires a confidence passing score within bounds", () => {
    expect(TS_CONFIG.confidence.passingScore).toBeGreaterThanOrEqual(0);
    expect(TS_CONFIG.confidence.passingScore).toBeLessThanOrEqual(100);
  });
});
