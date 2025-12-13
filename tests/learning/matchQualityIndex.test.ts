import { describe, expect, it } from "vitest";

import { calculateMatchQualityIndex } from "@/lib/learning/matchQualityIndex";

describe("calculateMatchQualityIndex", () => {
  const baseDates = {
    created: new Date("2024-01-01T00:00:00Z"),
    hired: new Date("2024-01-21T00:00:00Z"),
  };

  it("prioritises interview rate and hire rate with confidence as stabilizer", () => {
    const result = calculateMatchQualityIndex({
      jobId: "job-123",
      hiringOutcomes: { totalCandidates: 50, interviewed: 20, hired: 4 },
      feedback: { positive: 12, negative: 4 },
      confidenceBands: { lower: 0.15, upper: 0.35 },
      timeToFill: { jobCreatedAt: baseDates.created, hiredAt: baseDates.hired, baselineDays: 30 },
    });

    expect(result.jobId).toBe("job-123");
    expect(result.components.interviewRate).toBeCloseTo(40, 1);
    expect(result.components.hireRate).toBeCloseTo(36.5, 1);
    expect(result.components.confidenceAlignment).toBeCloseTo(88.4, 1);
    expect(result.score).toBeCloseTo(46, 1);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles limited signals deterministically", () => {
    const result = calculateMatchQualityIndex({
      jobId: "job-empty",
      hiringOutcomes: { totalCandidates: 10, interviewed: 0, hired: 0 },
      feedback: { positive: 0, negative: 0 },
      confidenceBands: { lower: 0.2, upper: 0.4 },
      timeToFill: { jobCreatedAt: baseDates.created, hiredAt: null, baselineDays: 20 },
    });

    expect(result.components.interviewRate).toBe(0);
    expect(result.components.hireRate).toBeCloseTo(15, 1); // neutral feedback stabilises the absence of hires
    expect(result.components.confidenceAlignment).toBeCloseTo(61.5, 1); // band + time-to-fill stabilizer
    expect(result.score).toBeCloseTo(14.5, 1);
  });

  it("penalises being outside confidence bands and slow time-to-fill", () => {
    const result = calculateMatchQualityIndex({
      jobId: "job-drifting",
      hiringOutcomes: { totalCandidates: 40, interviewed: 30, hired: 2 },
      feedback: { positive: 4, negative: 6 },
      confidenceBands: { lower: 0.3, upper: 0.5 },
      timeToFill: { jobCreatedAt: baseDates.created, hiredAt: new Date("2024-03-01T00:00:00Z"), baselineDays: 25 },
    });

    expect(result.components.interviewRate).toBeCloseTo(75, 1);
    expect(result.components.hireRate).toBeLessThan(40);
    expect(result.components.confidenceAlignment).toBeLessThan(50);
    expect(result.score).toBeGreaterThan(30);
    expect(result.score).toBeLessThan(result.components.interviewRate);
  });
});
