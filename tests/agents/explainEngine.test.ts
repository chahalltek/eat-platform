import { describe, expect, it } from "vitest";

import { buildExplanation, type ExplainInput } from "@/lib/agents/explainEngine";

const baseJob = {
  id: "job-1",
  location: "new york",
  seniorityLevel: "mid",
  minExperienceYears: 5,
  maxExperienceYears: 8,
  skills: [
    { name: "TypeScript", normalizedName: "typescript", required: true },
    { name: "React", normalizedName: "react", required: true },
    { name: "Node.js", normalizedName: "node.js", required: false },
  ],
};

const baseCandidate = {
  id: "cand-1",
  location: "new york",
  totalExperienceYears: 6,
  seniorityLevel: "mid",
  skills: [
    { name: "TypeScript", normalizedName: "typescript" },
    { name: "React", normalizedName: "react" },
    { name: "Node.js", normalizedName: "node.js" },
  ],
};

const detailedConfig = { explain: { level: "detailed" }, scoring: {}, safety: {} } as const;
const compactConfig = { explain: { level: "compact" }, scoring: {}, safety: {} } as const;

function buildInput(overrides: Partial<ExplainInput> = {}): ExplainInput {
  return {
    job: baseJob,
    candidate: baseCandidate,
    match: {
      candidateId: baseCandidate.id,
      score: 92,
      signals: {
        mustHaveSkillsCoverage: 0.95,
        niceToHaveSkillsCoverage: 0.7,
        experienceAlignment: 0.9,
        locationAlignment: 0.9,
      },
    },
    confidence: { band: "HIGH", reasons: ["complete skill data"], score: 0.82, candidateId: baseCandidate.id },
    config: detailedConfig,
    ...overrides,
  };
}

describe("buildExplanation", () => {
  it("emphasizes strengths for HIGH confidence candidates", () => {
    const explanation = buildExplanation(buildInput());

    expect(explanation.strengths).toContain("High must-have skill coverage (95%).");
    expect(explanation.strengths.some((s) => s.includes("High confidence band"))).toBe(true);
    expect(explanation.risks[0]).toBe("No significant risks flagged.");
  });

  it("highlights a single risk for MEDIUM confidence when alignment is mostly strong", () => {
    const explanation = buildExplanation(
      buildInput({
        confidence: { band: "MEDIUM", reasons: ["partial engagement data"], score: 0.65, candidateId: baseCandidate.id },
        match: {
          candidateId: baseCandidate.id,
          score: 78,
          signals: {
            mustHaveSkillsCoverage: 0.85,
            niceToHaveSkillsCoverage: 0.6,
            experienceAlignment: 0.65,
            locationAlignment: 0.35,
          },
        },
      }),
    );

    expect(explanation.risks.length).toBeGreaterThanOrEqual(1);
    expect(explanation.risks[0]).toBe("Location mismatch could impact availability expectations.");
  });

  it("surfaces missing must-haves and low confidence risks", () => {
    const explanation = buildExplanation(
      buildInput({
        confidence: { band: "LOW", reasons: ["limited profile"], score: 0.35, candidateId: baseCandidate.id },
        match: {
          candidateId: baseCandidate.id,
          score: 52,
          signals: {
            mustHaveSkillsCoverage: 0.4,
            niceToHaveSkillsCoverage: 0.5,
            experienceAlignment: 0.4,
            locationAlignment: 0.9,
          },
        },
      }),
    );

    expect(explanation.risks).toContain("Missing must-have skills may require ramp-up.");
    expect(explanation.risks).toContain("Low confidence band; profile data needs manual validation.");
  });

  it("respects compact vs detailed verbosity rules", () => {
    const compact = buildExplanation(buildInput({ config: compactConfig }));
    const detailed = buildExplanation(buildInput({ config: detailedConfig }));

    expect(compact.strengths.length).toBeLessThanOrEqual(2);
    expect(compact.risks.length).toBeLessThanOrEqual(1);

    expect(detailed.strengths.length).toBeGreaterThanOrEqual(3);
    expect(detailed.risks.length).toBeGreaterThanOrEqual(1);
  });
});
