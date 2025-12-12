import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONFIDENCE_CONFIG,
  buildConfidenceSummary,
  getConfidenceBand,
  getConfidenceScore,
  type ConfidenceSignals,
} from "./confidenceEngine.v2";

const sampleSignals: ConfidenceSignals = {
  candidateId: "cand-1",
  must_have_coverage: 0.82,
  nice_to_have_coverage: 72,
  experience_alignment: 0.66,
  engagement_signal: null,
};

describe("getConfidenceScore", () => {
  it("normalizes inputs and averages using weights", () => {
    const { score, signalScores } = getConfidenceScore(sampleSignals);

    expect(signalScores.must_have_coverage).toBeCloseTo(0.82);
    expect(signalScores.nice_to_have_coverage).toBeCloseTo(0.72);
    expect(score).toBeCloseTo((0.82 + 0.72 + 0.66) / 3);
  });

  it("returns zero when no weighted signals are present", () => {
    const { score } = getConfidenceScore({ candidateId: "cand-2", engagement_signal: undefined });

    expect(score).toBe(0);
  });
});

describe("getConfidenceBand", () => {
  it("applies default thresholds", () => {
    expect(getConfidenceBand(0.8)).toBe("HIGH");
    expect(getConfidenceBand(0.6)).toBe("MEDIUM");
    expect(getConfidenceBand(0.59)).toBe("LOW");
  });

  it("respects custom bands", () => {
    const config = { ...DEFAULT_CONFIDENCE_CONFIG, bands: { high: 0.9, medium: 0.5 } };

    expect(getConfidenceBand(0.85, config)).toBe("MEDIUM");
    expect(getConfidenceBand(0.91, config)).toBe("HIGH");
  });
});

describe("buildConfidenceSummary", () => {
  it("returns HIGH band reasons", () => {
    const summary = buildConfidenceSummary(0.83, sampleSignals);

    expect(summary.band).toBe("HIGH");
    expect(summary.reasons[0]).toContain("HIGH confidence band");
  });

  it("includes weakest signal for MEDIUM band", () => {
    const summary = buildConfidenceSummary(0.65, sampleSignals);

    expect(summary.band).toBe("MEDIUM");
    expect(summary.reasons[0]).toContain("weakest factor");
    expect(summary.reasons[1]).toContain("MEDIUM confidence band");
  });

  it("notes strongest signal for LOW band with signals", () => {
    const summary = buildConfidenceSummary(0.4, sampleSignals);

    expect(summary.band).toBe("LOW");
    expect(summary.reasons[0]).toContain("shows some strength");
    expect(summary.reasons[0]).toContain("LOW");
  });

  it("handles LOW band with no signals", () => {
    const summary = buildConfidenceSummary(0.2);

    expect(summary.band).toBe("LOW");
    expect(summary.reasons[0]).toContain("Insufficient signal data");
  });
});
