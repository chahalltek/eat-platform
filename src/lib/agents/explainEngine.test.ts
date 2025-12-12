import { describe, expect, it, vi } from "vitest";

import { buildExplanation, maybePolishExplanation } from "./explainEngine";
import type { MatchResult } from "./matchEngine";

const baseJob = {
  id: "job-1",
  location: "new york",
  seniorityLevel: "mid",
  minExperienceYears: null,
  maxExperienceYears: null,
  skills: [
    { id: "s1", name: "TypeScript", normalizedName: "typescript", required: true },
    { id: "s2", name: "React", normalizedName: "react", required: false },
  ],
};

const baseCandidate = {
  id: "cand-1",
  location: "new york",
  totalExperienceYears: 5,
  seniorityLevel: "mid",
  skills: [
    { id: "c1", name: "TypeScript", normalizedName: "typescript" },
    { id: "c2", name: "React", normalizedName: "react" },
  ],
};

const match: MatchResult = {
  candidateId: "cand-1",
  score: 90,
  signals: {
    mustHaveSkillsCoverage: 0.9,
    niceToHaveSkillsCoverage: 0.7,
    experienceAlignment: 0.8,
    locationAlignment: 0.4,
  },
};

const confidence = { score: 80, category: "MEDIUM" as const, reasons: ["Profile completeness supports reliability."] };

const compactConfig = { explain: { level: "compact", includeWeights: false }, scoring: {}, safety: {} } as const;
const detailedConfig = { explain: { level: "detailed", includeWeights: false }, scoring: {}, safety: {} } as const;

describe("buildExplanation", () => {
  it("returns compact strengths and risks when configured", () => {
    const explanation = buildExplanation({
      job: baseJob,
      candidate: baseCandidate,
      match,
      confidenceBand: confidence,
      config: compactConfig,
    });

    expect(explanation.strengths.length).toBeLessThanOrEqual(2);
    expect(explanation.strengths.length).toBeGreaterThanOrEqual(1);
    expect(explanation.risks.length).toBeLessThanOrEqual(1);
  });

  it("returns detailed strengths and risks when configured", () => {
    const explanation = buildExplanation({
      job: baseJob,
      candidate: baseCandidate,
      match,
      confidenceBand: confidence,
      config: detailedConfig,
    });

    expect(explanation.strengths.length).toBeGreaterThanOrEqual(3);
    expect(explanation.risks.length).toBeGreaterThanOrEqual(1);
  });

  it("includes weight notes when includeWeights is true", () => {
    const explanation = buildExplanation({
      job: baseJob,
      candidate: baseCandidate,
      match,
      confidenceBand: confidence,
      config: { explain: { level: "detailed", includeWeights: true }, scoring: {}, safety: {} },
    });

    expect(explanation.notes?.[0]).toContain("Signal blend");
  });
});

describe("maybePolishExplanation", () => {
  it("uses LLM polish when allowed", async () => {
    const callLLMFn = vi.fn().mockResolvedValue("Polished summary");
    const explanation = buildExplanation({
      job: baseJob,
      candidate: baseCandidate,
      match,
      confidenceBand: confidence,
      config: { explain: { level: "detailed", includeWeights: true }, scoring: {}, safety: {} },
    });

    const polished = await maybePolishExplanation(explanation, {
      config: { explain: { level: "detailed", includeWeights: true }, scoring: {}, safety: {} },
      fireDrill: false,
      callLLMFn,
    });

    expect(polished.summary).toBe("Polished summary");
    expect(callLLMFn).toHaveBeenCalledOnce();
  });

  it("skips LLM polish in Fire Drill", async () => {
    const callLLMFn = vi.fn().mockResolvedValue("Should not be used");
    const explanation = buildExplanation({
      job: baseJob,
      candidate: baseCandidate,
      match,
      confidenceBand: confidence,
      config: compactConfig,
    });

    const polished = await maybePolishExplanation(explanation, {
      config: { explain: { level: "compact", includeWeights: true }, scoring: {}, safety: {} },
      fireDrill: true,
      callLLMFn,
    });

    expect(polished.summary).toBe(explanation.summary);
    expect(callLLMFn).not.toHaveBeenCalled();
  });
});
