import { describe, expect, it } from "vitest";

import { buildJustification, type JustificationInput } from "@/lib/agents/justificationEngine";

const baseJob = {
  id: "job-1",
  title: "Backend Engineer",
  location: "remote",
  skills: [],
};

const baseCandidate = {
  id: "cand-1",
  name: "Alex Doe",
  skills: [],
};

function getLinesBetween(body: string, start: string, end: string): string[] {
  const lines = body.split("\n");
  const startIndex = lines.indexOf(start);
  const endIndex = lines.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return [];
  return lines.slice(startIndex + 1, endIndex).filter((line) => line.startsWith("- "));
}

describe("buildJustification", () => {
  it("formats subject and uses provided explanation details when available", () => {
    const input: JustificationInput = {
      job: baseJob,
      candidate: baseCandidate,
      match: {
        candidateId: baseCandidate.id,
        score: 88,
        signals: { mustHaveSkillsCoverage: 0.92, experienceAlignment: 0.85, locationAlignment: 0.9 },
      },
      confidence: {
        candidateId: baseCandidate.id,
        band: "HIGH",
        score: 0.82,
        reasons: ["complete signals"],
      },
      explanation: {
        summary: "Alex shows strong alignment for backend ownership with reliable delivery history.",
        strengths: [
          "Deep experience with TypeScript services.",
          "Proven ownership of production APIs.",
          "Strong collaboration record.",
          "Mentors junior engineers.",
        ],
        risks: ["Limited exposure to data pipelines."],
      },
    };

    const output = buildJustification(input);
    const strengths = getLinesBetween(output.body, "Top strengths:", "Risks:");
    const risks = getLinesBetween(output.body, "Risks:", "Next best step:");

    expect(output.subject).toBe("Recommendation: Alex Doe for Backend Engineer");
    expect(output.body.startsWith(input.explanation.summary)).toBe(true);
    expect(strengths).toEqual([
      "- Deep experience with TypeScript services.",
      "- Proven ownership of production APIs.",
      "- Strong collaboration record.",
    ]);
    expect(risks.length).toBe(1);
    expect(output.body).toContain("Confidence: HIGH (82%) – complete signals");
  });

  it("produces deterministic fallback text when explanation and confidence are missing", () => {
    const output = buildJustification({
      job: { id: "job-2", location: "london", skills: [] },
      candidate: { id: "cand-2", location: "remote", skills: [] },
      match: {
        candidateId: "cand-2",
        score: 0.74,
        signals: { mustHaveSkillsCoverage: 0.6, experienceAlignment: 0.55, locationAlignment: 0.4 },
      },
    });

    const strengths = getLinesBetween(output.body, "Top strengths:", "Risks:");
    const risks = getLinesBetween(output.body, "Risks:", "Next best step:");

    expect(output.subject).toBe("Recommendation: cand-2 for job-2");
    expect(output.body).not.toContain("Confidence:");
    expect(strengths).toHaveLength(3);
    expect(risks.length).toBeGreaterThanOrEqual(1);
    expect(risks.length).toBeLessThanOrEqual(2);
    expect(output.body).toContain("74% match for job-2");
    expect(output.body).toContain("Next best step:\n- Schedule a structured screen focusing on");
  });
});
