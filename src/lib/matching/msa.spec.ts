import { describe, expect, it } from "vitest";

import { computeMatchScore } from "@/lib/matching/msa";

const baseCandidate = {
  id: "cand-1",
  fullName: "Terry Candidate",
  email: null,
  phone: null,
  location: "Remote",
  currentTitle: "Senior Engineer",
  currentCompany: "Acme",
  totalExperienceYears: 8,
  seniorityLevel: "Senior",
  summary: null,
  rawResumeText: null,
  sourceType: null,
  sourceTag: null,
  parsingConfidence: null,
  status: null,
  tenantId: "tenant-1",
  createdAt: new Date("2024-05-01T00:00:00Z"),
  updatedAt: new Date("2024-05-02T00:00:00Z"),
  deletedAt: null,
  skills: [
    {
      id: "cand-skill-1",
      candidateId: "cand-1",
      name: "React",
      normalizedName: "react",
      proficiency: "High",
      yearsOfExperience: 4,
      tenantId: "tenant-1",
    },
    {
      id: "cand-skill-2",
      candidateId: "cand-1",
      name: "TypeScript",
      normalizedName: "typescript",
      proficiency: "High",
      yearsOfExperience: 3,
      tenantId: "tenant-1",
    },
  ],
};

const baseJob = {
  id: "job-1",
  customerId: null,
  title: "Senior Frontend Engineer",
  location: "Remote",
  employmentType: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryInterval: null,
  seniorityLevel: "Senior",
  rawDescription: "Build UI",
  status: null,
  sourceType: null,
  sourceTag: null,
  createdAt: new Date("2024-04-01T00:00:00Z"),
  updatedAt: new Date("2024-04-02T00:00:00Z"),
  tenantId: "tenant-1",
  skills: [
    {
      id: "job-skill-1",
      jobReqId: "job-1",
      name: "React",
      normalizedName: "react",
      required: true,
      weight: 2,
      tenantId: "tenant-1",
    },
    {
      id: "job-skill-2",
      jobReqId: "job-1",
      name: "TypeScript",
      normalizedName: "typescript",
      required: false,
      weight: 1,
      tenantId: "tenant-1",
    },
  ],
};

describe("computeMatchScore", () => {
  it("awards full skill credit for exact matches", () => {
    const result = computeMatchScore({ candidate: baseCandidate, jobReq: baseJob });

    expect(result.skillScore).toBe(100);
    expect(result.reasons).toContain("Required skill matched: React");
    expect(result.reasons).toContain("Nice-to-have skill matched: TypeScript");
    expect(result.score).toBe(95);
  });

  it("records missing required skills and lowers the score", () => {
    const result = computeMatchScore({
      candidate: { ...baseCandidate, skills: [baseCandidate.skills[0]!] },
      jobReq: {
        ...baseJob,
        skills: [
          baseJob.skills[0]!,
          baseJob.skills[1]!,
          {
            id: "job-skill-3",
            jobReqId: "job-1",
            name: "GraphQL",
            normalizedName: "graphql",
            required: true,
            weight: 1,
            tenantId: "tenant-1",
          },
        ],
      },
    });

    expect(result.skillScore).toBeLessThan(100);
    expect(result.reasons).toContain("Missing required skill: GraphQL");
    expect(result.explanation.missingSkills).toContain("GraphQL");
  });

  it("enforces guardrails when must-have skills are missing", () => {
    const result = computeMatchScore(
      {
        candidate: { ...baseCandidate, skills: [baseCandidate.skills[0]!] },
        jobReq: {
          ...baseJob,
          skills: [
            baseJob.skills[0]!,
            baseJob.skills[1]!,
            {
              id: "job-skill-3",
              jobReqId: "job-1",
              name: "GraphQL",
              normalizedName: "graphql",
              required: true,
              weight: 1,
              tenantId: "tenant-1",
            },
          ],
        },
      },
      { guardrails: { requireMustHaveSkills: true } },
    );

    expect(result.score).toBe(0);
    expect(result.reasons[0]).toContain("Guardrail");
    expect(result.explanation.riskAreas).toContain("Guardrail: candidate missing required skills");
  });
});
