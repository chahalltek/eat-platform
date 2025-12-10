import { describe, expect, it } from "vitest";

import { categorizeConfidence } from "@/app/jobs/[jobId]/matches/confidence";
import { computeCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";

type CandidateInput = Parameters<typeof computeCandidateConfidenceScore>[0]["candidate"];

const strongCandidate: CandidateInput = {
  id: "cand-strong",
  fullName: "Ada Lovelace",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-02-01T00:00:00Z"),
  rawResumeText: "Extensive experience building analytical systems.",
  summary: "Inventive engineer with deep data background.",
  location: "Remote",
  currentTitle: "Staff Data Engineer",
  email: "ada@example.com",
  phone: "555-1212",
  totalExperienceYears: 10,
  seniorityLevel: "Senior",
  currentCompany: "Analytical Machines",
  sourceType: "Referral",
  sourceTag: "network",
  parsingConfidence: 0.95,
  status: "ACTIVE",
  skills: [
    { id: "skill-1", name: "Python", proficiency: "Expert", yearsOfExperience: 7 },
    { id: "skill-2", name: "SQL", proficiency: "Advanced", yearsOfExperience: 8 },
    { id: "skill-3", name: "Airflow", proficiency: "Advanced", yearsOfExperience: 5 },
    { id: "skill-4", name: "Data Modeling", proficiency: "Advanced", yearsOfExperience: 6 },
  ],
};

const mixedSignalsCandidate: CandidateInput = {
  ...strongCandidate,
  id: "cand-mixed",
  currentTitle: null,
  phone: null,
  parsingConfidence: undefined,
  skills: [
    { id: "skill-1", name: "Python", proficiency: "Intermediate", yearsOfExperience: 3 },
    { id: "skill-2", name: "SQL", proficiency: null, yearsOfExperience: null },
    { id: "skill-3", name: "Tableau", proficiency: "Beginner", yearsOfExperience: 1 },
  ],
};

const lowSignalsCandidate: CandidateInput = {
  ...strongCandidate,
  id: "cand-low",
  fullName: "Unknown",
  rawResumeText: "",
  summary: "",
  location: "",
  currentTitle: "",
  email: "",
  phone: "",
  parsingConfidence: 0.1,
  sourceType: "unknown",
  skills: [],
};

describe("CONFIDENCE agent aggregation", () => {
  it("assigns a high confidence band when all signals are strong", () => {
    const result = computeCandidateConfidenceScore({ candidate: strongCandidate });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(categorizeConfidence(result.score)).toBe("High");
    expect(result.breakdown.resumeCompleteness.score).toBe(100);
    expect(result.breakdown.skillCoverage.score).toBeGreaterThan(70);
    expect(result.breakdown.agentAgreement.score).toBeGreaterThan(90);
    expect(result.breakdown.unknownFields.score).toBe(100);
  });

  it("returns a medium confidence band when signals are mixed", () => {
    const result = computeCandidateConfidenceScore({ candidate: mixedSignalsCandidate });

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThan(80);
    expect(categorizeConfidence(result.score)).toBe("Medium");
    expect(result.breakdown.resumeCompleteness.missingFields).toEqual(
      expect.arrayContaining(["current title", "phone"]),
    );
    expect(result.breakdown.agentAgreement.reason).toContain("neutral agent agreement");
  });

  it("drops to a low confidence band when signals conflict or are missing", () => {
    const result = computeCandidateConfidenceScore({ candidate: lowSignalsCandidate });

    expect(result.score).toBeLessThan(40);
    expect(categorizeConfidence(result.score)).toBe("Low");
    expect(result.breakdown.skillCoverage.recordedSkills).toBe(0);
    expect(result.breakdown.unknownFields.unknownFieldLabels.length).toBeGreaterThan(0);
  });

  it("handles missing or null signals without throwing", () => {
    const minimallyKnownCandidate: CandidateInput = {
      ...strongCandidate,
      id: "cand-minimal",
      fullName: null as unknown as string,
      rawResumeText: null as unknown as string,
      summary: null,
      location: null,
      currentTitle: null,
      email: null,
      phone: null,
      parsingConfidence: null as unknown as number,
      skills: undefined,
    };

    const result = computeCandidateConfidenceScore({ candidate: minimallyKnownCandidate });

    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.breakdown.resumeCompleteness.completedFields).toBe(0);
    expect(result.breakdown.agentAgreement.score).toBe(60);
    expect(categorizeConfidence(result.score)).toBe("Low");
  });
});
