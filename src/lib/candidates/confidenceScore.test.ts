import { describe, expect, it } from "vitest";

import { computeCandidateConfidenceScore } from "./confidenceScore";

type CandidateInput = Parameters<typeof computeCandidateConfidenceScore>[0]["candidate"];

const baseCandidate: CandidateInput = {
  id: "cand_123",
  fullName: "A Candidate",
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-02T00:00:00Z"),
  rawResumeText: "Detailed resume text",
  summary: "Experienced engineer",
  location: "Remote",
  currentTitle: "Senior Engineer",
  email: "candidate@example.com",
  phone: "555-1234",
  totalExperienceYears: 8,
  seniorityLevel: null,
  currentCompany: null,
  sourceType: "Referral",
  sourceTag: null,
  parsingConfidence: 0.82,
  status: null,
  skills: [
    { id: "skill-1", name: "TypeScript", proficiency: "High", yearsOfExperience: 5 },
  ],
};

describe("computeCandidateConfidenceScore", () => {
  it("calculates weighted confidence score and breakdown", () => {
    const result = computeCandidateConfidenceScore({ candidate: baseCandidate });

    expect(result.score).toBe(80);
    expect(result.breakdown.resumeCompleteness.completedFields).toBeGreaterThan(0);
    expect(result.breakdown.skillCoverage.recordedSkills).toBeGreaterThan(0);
    expect(result.breakdown.unknownFields.score).toBe(100);
  });

  it("normalizes weights safely when all weights are zero", () => {
    const result = computeCandidateConfidenceScore({
      candidate: {
        ...baseCandidate,
        sourceType: null,
        parsingConfidence: undefined,
        rawResumeText: "",
        summary: "",
        skills: [],
      },
      weights: { resumeCompleteness: 0, skillCoverage: 0, agentAgreement: 0, unknownFields: 0 },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Number.isFinite(result.score)).toBe(true);
  });
});
