import { describe, expect, it } from "vitest";

import { buildShortlist } from "@/lib/agents/shortlistEngine";
import { guardrailsPresets } from "@/lib/guardrails/presets";

const baseConfig = {
  ...guardrailsPresets.balanced,
  shortlist: { strategy: "quality", maxCandidates: 3 },
};

describe("buildShortlist", () => {
  it("applies quality strategy ordering and confidence tiebreak", () => {
    const matches = [
      { candidateId: "a", score: 80, confidenceBand: "MEDIUM", signals: {} },
      { candidateId: "b", score: 80, confidenceBand: "HIGH", signals: {} },
      { candidateId: "c", score: 70, confidenceBand: "HIGH", signals: {} },
    ];

    const shortlist = buildShortlist({ matches, config: baseConfig });

    expect(shortlist.shortlistedCandidateIds).toEqual(["b", "a", "c"]);
  });

  it("filters to strict matches when strategy is strict", () => {
    const matches = [
      { candidateId: "a", score: 90, confidenceBand: "MEDIUM", signals: {} },
      { candidateId: "b", score: 70, confidenceBand: "HIGH", signals: {} },
      { candidateId: "c", score: 40, confidenceBand: "HIGH", signals: {} },
    ];

    const shortlist = buildShortlist({
      matches,
      config: { ...baseConfig, shortlist: { strategy: "strict" }, scoring: baseConfig.scoring },
      strategy: "strict",
    });

    expect(shortlist.shortlistedCandidateIds).toEqual(["b", "c"]);
  });

  it("uses fast strategy to return top scores without extra filtering", () => {
    const matches = [
      { candidateId: "a", score: 80, confidenceBand: "LOW", signals: {} },
      { candidateId: "b", score: 60, confidenceBand: "HIGH", signals: {} },
      { candidateId: "c", score: 90, confidenceBand: "MEDIUM", signals: {} },
    ];

    const shortlist = buildShortlist({
      matches,
      config: { ...baseConfig, shortlist: { strategy: "fast", maxCandidates: 2 } },
    });

    expect(shortlist.shortlistedCandidateIds).toEqual(["c", "a"]);
  });

  it("avoids near-duplicates in diversity mode", () => {
    const matches = [
      { candidateId: "a", score: 85, confidenceBand: "HIGH", signals: { mustHaveSkillsCoverage: 0.9 } },
      { candidateId: "b", score: 84.5, confidenceBand: "HIGH", signals: { mustHaveSkillsCoverage: 0.91 } },
      { candidateId: "c", score: 75, confidenceBand: "MEDIUM", signals: { mustHaveSkillsCoverage: 0.5 } },
    ];

    const shortlist = buildShortlist({
      matches,
      config: { ...baseConfig, shortlist: { strategy: "diversity", maxCandidates: 2 } },
    });

    expect(shortlist.shortlistedCandidateIds).toEqual(["a", "c"]);
  });
});
