import { describe, expect, it } from "vitest";

import { buildShortlist } from "@/lib/agents/shortlistEngine";
import { guardrailsPresets } from "@/lib/guardrails/presets";

describe("shortlistEngine", () => {
  const baseConfig = guardrailsPresets.balanced;

  it("quality returns top N with confidence tie-break", () => {
    const result = buildShortlist({
      matches: [
        { candidateId: "a", score: 92, confidenceBand: "MEDIUM" },
        { candidateId: "b", score: 92, confidenceBand: "HIGH" },
        { candidateId: "c", score: 75, confidenceBand: "HIGH" },
      ],
      config: { ...baseConfig, shortlist: { maxCandidates: 2 } },
      strategy: "quality",
    });

    expect(result.shortlistedCandidateIds).toEqual(["b", "a"]);
    expect(result.cutoffScore).toBe(92);
  });

  it("strict excludes MED/LOW and enforces shortlistMinScore", () => {
    const result = buildShortlist({
      matches: [
        { candidateId: "a", score: 88, confidenceBand: "HIGH" },
        { candidateId: "b", score: 82, confidenceBand: "HIGH" },
        { candidateId: "c", score: 90, confidenceBand: "MEDIUM" },
      ],
      config: {
        ...baseConfig,
        scoring: { ...baseConfig.scoring, thresholds: { shortlistMinScore: 85 } },
      },
      strategy: "strict",
    });

    expect(result.shortlistedCandidateIds).toEqual(["a"]);
    expect(result.cutoffScore).toBe(88);
  });

  it("diversity avoids returning top N clones when signals are near-identical", () => {
    const result = buildShortlist({
      matches: [
        { candidateId: "a", score: 95, confidenceBand: "HIGH", signals: { mustHaveSkillsCoverage: 0.9 } },
        { candidateId: "b", score: 94, confidenceBand: "HIGH", signals: { mustHaveSkillsCoverage: 0.91 } },
        { candidateId: "c", score: 86, confidenceBand: "MEDIUM", signals: { mustHaveSkillsCoverage: 0.55 } },
        { candidateId: "d", score: 82, confidenceBand: "LOW", signals: { mustHaveSkillsCoverage: 0.2 } },
      ],
      config: { ...baseConfig, shortlist: { maxCandidates: 3 } },
      strategy: "diversity",
    });

    expect(result.shortlistedCandidateIds).toEqual(["a", "c", "d"]);
  });

  it("honors maxCandidates regardless of available matches", () => {
    const result = buildShortlist({
      matches: [
        { candidateId: "a", score: 99, confidenceBand: "HIGH" },
        { candidateId: "b", score: 98, confidenceBand: "HIGH" },
        { candidateId: "c", score: 97, confidenceBand: "MEDIUM" },
      ],
      config: { ...baseConfig, shortlist: { maxCandidates: 1 }, scoring: baseConfig.scoring },
      strategy: "fast",
    });

    expect(result.shortlistedCandidateIds).toEqual(["a"]);
    expect(result.cutoffScore).toBe(99);
  });
});
