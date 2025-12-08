import { describe, expect, it } from "vitest";

import { computeMatchScore } from "@/lib/matching/msa";

const buildCandidate = (overrides: Partial<Parameters<typeof computeMatchScore>[0]["candidate"]> = {}) => ({
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
  status: null,
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
  ...overrides,
});

const buildJob = (overrides: Partial<Parameters<typeof computeMatchScore>[0]["jobReq"]> = {}) => ({
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
  ...overrides,
});

describe("match scoring", () => {
  it("awards full credit when skills perfectly overlap", () => {
    const candidate = buildCandidate();
    const jobReq = buildJob();

    const result = computeMatchScore({ candidate, jobReq });

    expect(result.skillScore).toBe(100);
    expect(result.explanation.missingSkills).toHaveLength(0);
  });

  it("drops skill score to zero when nothing overlaps", () => {
    const candidate = buildCandidate({
      skills: [
        {
          id: "cand-skill-3",
          candidateId: "cand-1",
          name: "Go",
          normalizedName: "go",
          proficiency: "Medium",
          yearsOfExperience: 2,
          tenantId: "tenant",
        },
      ],
    });
    const jobReq = buildJob({
      skills: [
        {
          id: "job-skill-3",
          jobReqId: "job-1",
          name: "Python",
          normalizedName: "python",
          required: true,
          weight: 2,
          tenantId: "tenant",
        },
      ],
    });

    const result = computeMatchScore({ candidate, jobReq });

    expect(result.skillScore).toBe(0);
    expect(result.explanation.missingSkills).toContain("Python");
  });

  it("splits credit when only part of the required stack overlaps", () => {
    const candidate = buildCandidate({
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
      ],
    });
    const jobReq = buildJob({
      skills: [
        {
          id: "job-skill-1",
          jobReqId: "job-1",
          name: "React",
          normalizedName: "react",
          required: true,
          weight: 1,
          tenantId: "tenant",
        },
        {
          id: "job-skill-2",
          jobReqId: "job-1",
          name: "GraphQL",
          normalizedName: "graphql",
          required: true,
          weight: 1,
          tenantId: "tenant",
        },
      ],
    });

    const result = computeMatchScore({ candidate, jobReq });

    expect(result.skillScore).toBe(50);
    expect(result.explanation.missingSkills).toContain("GraphQL");
  });

  it("rewards title-aligned roles more than mismatched ones", () => {
    const alignedCandidate = buildCandidate({
      location: "Remote",
      seniorityLevel: "Mid",
    });
    const alignedJob = buildJob({ location: "Remote", seniorityLevel: "Mid" });

    const misalignedCandidate = buildCandidate({
      location: "Austin",
      seniorityLevel: "Senior",
    });
    const misalignedJob = buildJob({ location: "Remote", seniorityLevel: "Mid" });

    const alignedScore = computeMatchScore({ candidate: alignedCandidate, jobReq: alignedJob });
    const misalignedScore = computeMatchScore({ candidate: misalignedCandidate, jobReq: misalignedJob });

    expect(alignedScore.score).toBeGreaterThan(misalignedScore.score);
    expect(misalignedScore.explanation.riskAreas).not.toHaveLength(0);
  });
});
