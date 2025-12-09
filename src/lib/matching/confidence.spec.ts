import { describe, expect, it } from "vitest";

import { computeMatchConfidence } from "@/lib/matching/confidence";

const baseCandidate = {
  id: "cand-1",
  fullName: "Jordan Candidate",
  email: null,
  phone: null,
  location: "Remote",
  currentTitle: "Engineer",
  currentCompany: "Acme",
  totalExperienceYears: 6,
  seniorityLevel: "Mid",
  summary: null,
  rawResumeText: null,
  sourceType: null,
  sourceTag: null,
  parsingConfidence: null,
  trustScore: null,
  status: null,
  normalizedSkills: [],
  tenantId: "tenant",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
  deletedAt: null,
  skills: [
    {
      id: "cand-skill-1",
      candidateId: "cand-1",
      name: "React",
      normalizedName: "react",
      proficiency: "High",
      yearsOfExperience: 4,
      tenantId: "tenant",
    },
    {
      id: "cand-skill-2",
      candidateId: "cand-1",
      name: "TypeScript",
      normalizedName: "typescript",
      proficiency: "High",
      yearsOfExperience: 3,
      tenantId: "tenant",
    },
  ],
};

const baseJob = {
  id: "job-1",
  customerId: null,
  title: "Frontend Engineer",
  location: "Remote",
  employmentType: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryInterval: null,
  seniorityLevel: "Mid",
  rawDescription: "Build UI",
  status: null,
  sourceType: null,
  sourceTag: null,
  createdAt: new Date("2024-01-05T00:00:00Z"),
  updatedAt: new Date("2024-01-05T00:00:00Z"),
  tenantId: "tenant",
  skills: [
    {
      id: "job-skill-1",
      jobReqId: "job-1",
      name: "React",
      normalizedName: "react",
      required: true,
      weight: 2,
      tenantId: "tenant",
    },
    {
      id: "job-skill-2",
      jobReqId: "job-1",
      name: "TypeScript",
      normalizedName: "typescript",
      required: false,
      weight: 1,
      tenantId: "tenant",
    },
  ],
};

describe("computeMatchConfidence", () => {
  it("returns a confidence score with category and reasons", () => {
    const result = computeMatchConfidence({ candidate: baseCandidate, jobReq: baseJob });

    expect(result.score).toBeGreaterThan(0);
    expect(result.category).toBe("MEDIUM");
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.breakdown.skillCoverage).toBeGreaterThan(0);
  });

  it("drops category when profile details are missing", () => {
    const result = computeMatchConfidence({
      candidate: { ...baseCandidate, location: null, currentTitle: null, skills: [] },
      jobReq: { ...baseJob },
    });

    expect(result.score).toBeLessThan(75);
    expect(result.category).toBe("LOW");
    expect(result.reasons.some((reason) => reason.toLowerCase().includes("missing"))).toBe(true);
  });
});
