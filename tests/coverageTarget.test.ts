import { combineLabels, normalizeScore } from "../src/coverageTarget";

describe("coverageTarget", () => {
  it("combines labels when both are present", () => {
    expect(combineLabels("Primary", "Secondary")).toBe("Primary / Secondary");
  });

  it("returns the primary label when secondary is missing", () => {
    expect(combineLabels("Primary")).toBe("Primary");
  });

  it("handles missing labels", () => {
    expect(combineLabels("", "")).toBe("");
  });

  it("normalizes scores within bounds", () => {
    expect(normalizeScore(0.8)).toBe(0.8);
    expect(normalizeScore(1.5)).toBe(1);
    expect(normalizeScore(-0.5)).toBe(0);
  });

  it("applies custom max and rounds to three decimals", () => {
    expect(normalizeScore(7, 10)).toBe(0.7);
    expect(normalizeScore(3.333, 5)).toBe(0.667);
  });

  it("rejects non-positive maximums", () => {
    expect(() => normalizeScore(1, 0)).toThrowError("max must be positive");
  });
});
