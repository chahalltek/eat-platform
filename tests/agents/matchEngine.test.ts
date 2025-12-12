import { describe, expect, it } from "vitest";

import { guardrailsPresets } from "@/lib/guardrails/presets";
import { runMatch, type MatchInput } from "@/lib/agents/matchEngine";

describe("matchEngine", () => {
  const baseJob: MatchInput["job"] = {
    id: "job-1",
    location: "Remote",
    minExperienceYears: 3,
    maxExperienceYears: 8,
    skills: [
      { name: "React", normalizedName: "react", required: true },
      { name: "TypeScript", normalizedName: "typescript", required: true },
      { name: "GraphQL", normalizedName: "graphql", required: false },
    ],
  };

  it("returns perfect matches with full signal coverage", () => {
    const results = runMatch({
      job: baseJob,
      candidates: [
        {
          id: "c-1",
          location: "Remote",
          totalExperienceYears: 5,
          skills: [
            { name: "React", normalizedName: "react" },
            { name: "TypeScript", normalizedName: "typescript" },
            { name: "GraphQL", normalizedName: "graphql" },
          ],
        },
      ],
      config: guardrailsPresets.balanced,
    });

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(100);
    expect(results[0].signals).toEqual({
      mustHaveSkillsCoverage: 1,
      niceToHaveSkillsCoverage: 1,
      experienceAlignment: 1,
      locationAlignment: 1,
    });
  });

  it("accounts for partial matches across signals", () => {
    const results = runMatch({
      job: baseJob,
      candidates: [
        {
          id: "c-2",
          location: "Hybrid - San Francisco",
          totalExperienceYears: 2,
          skills: [
            { name: "React", normalizedName: "react" },
            { name: "GraphQL", normalizedName: "graphql" },
          ],
        },
      ],
      config: guardrailsPresets.aggressive,
    });

    expect(results).toHaveLength(1);
    expect(results[0].signals.mustHaveSkillsCoverage).toBeLessThan(1);
    expect(results[0].signals.niceToHaveSkillsCoverage).toBeGreaterThan(0);
    expect(results[0].score).toBeLessThan(100);
  });

  it("zeroes out candidates missing must-haves when required", () => {
    const results = runMatch({
      job: baseJob,
      candidates: [
        {
          id: "c-3",
          location: "Remote",
          totalExperienceYears: 5,
          skills: [{ name: "GraphQL", normalizedName: "graphql" }],
        },
      ],
      config: {
        ...guardrailsPresets.conservative,
        scoring: { ...guardrailsPresets.conservative.scoring, thresholds: { minMatchScore: 0 } },
        safety: { ...guardrailsPresets.conservative.safety, requireMustHaves: true },
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0);
    expect(results[0].signals.mustHaveSkillsCoverage).toBe(0);
  });

  it("filters out scores that fall below the guardrail threshold", () => {
    const results = runMatch({
      job: baseJob,
      candidates: [
        {
          id: "c-4",
          location: "Remote",
          totalExperienceYears: 1,
          skills: [{ name: "React", normalizedName: "react" }],
        },
      ],
      config: {
        ...guardrailsPresets.balanced,
        scoring: { ...guardrailsPresets.balanced.scoring, thresholds: { minMatchScore: 90 } },
      },
    });

    expect(results).toHaveLength(0);
  });

  it("switches between simple and weighted strategies deterministically", () => {
    const candidates: MatchInput["candidates"] = [
      {
        id: "c-simple",
        location: "Remote",
        totalExperienceYears: 1,
        skills: [
          { name: "React", normalizedName: "react" },
          { name: "TypeScript", normalizedName: "typescript" },
        ],
      },
      {
        id: "c-weighted",
        location: "New York",
        totalExperienceYears: 7,
        skills: [
          { name: "React", normalizedName: "react" },
          { name: "GraphQL", normalizedName: "graphql" },
        ],
      },
    ];

    const simpleResults = runMatch({
      job: baseJob,
      candidates,
      config: {
        ...guardrailsPresets.balanced,
        scoring: { ...guardrailsPresets.balanced.scoring, strategy: "simple", thresholds: { minMatchScore: 0 } },
        safety: { ...guardrailsPresets.balanced.safety, requireMustHaves: false },
      },
    });

    const weightedResults = runMatch({
      job: baseJob,
      candidates,
      config: {
        ...guardrailsPresets.balanced,
        safety: { ...guardrailsPresets.balanced.safety, requireMustHaves: false },
      },
    });

    expect(simpleResults[0].candidateId).toBe("c-simple");
    expect(weightedResults[0].candidateId).toBe("c-weighted");
  });
});
