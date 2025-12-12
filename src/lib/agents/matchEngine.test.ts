import { describe, expect, it } from "vitest";

import { guardrailsPresets } from "@/lib/guardrails/presets";

import { runMatch, type MatchInput } from "./matchEngine";

const baseJob = {
  id: "job-1",
  location: "Remote",
  skills: [
    { name: "React", normalizedName: "react", required: true },
    { name: "GraphQL", normalizedName: "graphql", required: true },
    { name: "TypeScript", normalizedName: "typescript", required: false },
  ],
};

const defaultConfig: MatchInput["config"] = guardrailsPresets.balanced;

describe("runMatch", () => {
  it("uses simple strategy for skills-only coverage", () => {
    const candidates: MatchInput["candidates"] = [
      {
        id: "c-1",
        location: "Remote",
        skills: [
          { name: "React", normalizedName: "react" },
          { name: "TypeScript", normalizedName: "typescript" },
        ],
      },
      {
        id: "c-2",
        location: "Remote",
        skills: [{ name: "React", normalizedName: "react" }],
      },
    ];

    const results = runMatch({
      job: baseJob,
      candidates,
      config: {
        ...defaultConfig,
        scoring: { ...defaultConfig.scoring, strategy: "simple", thresholds: { minMatchScore: 0 } },
        safety: { requireMustHaves: false },
      },
    });

    expect(results).toHaveLength(2);
    expect(results[0].candidateId).toBe("c-1");
    expect(results[0].signals.mustHaveSkillsCoverage).toBeCloseTo(0.5);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("applies weighted strategy with thresholds and guardrails", () => {
    const candidates: MatchInput["candidates"] = [
      {
        id: "c-1",
        location: "Remote",
        totalExperienceYears: 6,
        skills: [
          { name: "React", normalizedName: "react" },
          { name: "GraphQL", normalizedName: "graphql" },
        ],
      },
      {
        id: "c-2",
        location: "Onsite",
        totalExperienceYears: 1,
        skills: [{ name: "React", normalizedName: "react" }],
      },
    ];

    const config: MatchInput["config"] = {
      scoring: {
        strategy: "weighted",
        weights: { mustHaveSkills: 0.5, niceToHaveSkills: 0.2, experience: 0.2, location: 0.1 },
        thresholds: { minMatchScore: 60 },
      },
      safety: { requireMustHaves: true },
      explain: {},
    };

    const results = runMatch({
      job: { ...baseJob, minExperienceYears: 3 },
      candidates,
      config,
    });

    expect(results).toHaveLength(1);
    expect(results[0].candidateId).toBe("c-1");
    expect(results[0].signals.mustHaveSkillsCoverage).toBe(1);
    expect(results[0].signals.experienceAlignment).toBe(1);
  });

  it("drops candidates that miss required skills when guardrail is enabled", () => {
    const candidates: MatchInput["candidates"] = [
      {
        id: "c-1",
        location: "Remote",
        skills: [{ name: "TypeScript", normalizedName: "typescript" }],
      },
    ];

    const results = runMatch({
      job: baseJob,
      candidates,
      config: {
        scoring: guardrailsPresets.conservative.scoring,
        safety: { requireMustHaves: true },
        explain: {},
      },
    });

    expect(results).toHaveLength(0);
  });
});
