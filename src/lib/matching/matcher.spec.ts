import { describe, expect, it, vi } from "vitest";

import {
  ingestJob,
  matchCandidateToJob,
  normalizeJobSkills,
  normalizeWeightConfig,
} from "@/lib/matching/matcher";

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
    {
      id: "job-skill-3",
      jobReqId: "job-1",
      name: "GraphQL",
      normalizedName: "graphql",
      required: true,
      weight: 1,
      tenantId: "tenant",
    },
  ],
};

describe("skill normalization", () => {
  it("normalizes skill names and deduplicates entries", () => {
    const normalized = normalizeJobSkills([
      { name: " React  ", required: true },
      { name: "react", required: false },
      { name: "TypeScript", weight: 3 },
    ]);

    expect(normalized).toEqual([
      { name: "React", normalizedName: "react", required: true, weight: 2 },
      { name: "TypeScript", normalizedName: "typescript", required: false, weight: 3 },
    ]);
  });

  it("exposes a helper for weight normalization", () => {
    const normalized = normalizeWeightConfig({ skills: 0, location: 0, seniority: 0 });

    expect(normalized).toEqual({ skills: 1 / 3, location: 1 / 3, seniority: 1 / 3 });
  });
});

describe("job ingestion", () => {
  it("creates a job with normalized skills", async () => {
    const jobCreate = vi.fn(async ({ data }) => ({ id: "job-123", tenantId: "tenant", ...data }));
    const client = { jobReq: { create: jobCreate } } as any;

    const result = await ingestJob(
      {
        title: "Backend Engineer",
        location: "Remote",
        seniorityLevel: "Senior",
        rawDescription: "APIs",
        skills: [
          { name: "Node.js", required: true },
          { name: "PostgreSQL", required: false, weight: 2 },
        ],
      },
      client,
    );

    expect(jobCreate).toHaveBeenCalled();
    expect(result.skills).toEqual([
      { name: "Node.js", normalizedName: "node.js", required: true, weight: 2 },
      { name: "PostgreSQL", normalizedName: "postgresql", required: false, weight: 2 },
    ]);
  });
});

describe("candidate to job matching", () => {
  it("computes a weighted match and stores the result", async () => {
    const matchResultCreate = vi.fn(async ({ data }) => ({ id: "match-1", ...data }));
    const client = { matchResult: { create: matchResultCreate } } as any;

    const { matchScore, matchResult } = await matchCandidateToJob({
      candidate: baseCandidate,
      jobReq: baseJob,
      outreachInteractions: 1,
      prismaClient: client,
    });

    expect(matchScore.score).toBeGreaterThan(0);
    expect(matchScore.skillScore).toBe(75);
    expect(matchResultCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        candidateId: baseCandidate.id,
        jobReqId: baseJob.id,
        score: matchScore.score,
        skillScore: 75,
      }),
    });
    expect(matchResult.id).toBe("match-1");
  });

  it("handles edge cases with missing skills gracefully", async () => {
    const matchResultCreate = vi.fn(async ({ data }) => ({ id: "match-2", ...data }));
    const client = { matchResult: { create: matchResultCreate } } as any;

    const noSkillCandidate = { ...baseCandidate, skills: [] };
    const noSkillJob = { ...baseJob, skills: [] };

    const { matchScore } = await matchCandidateToJob({
      candidate: noSkillCandidate,
      jobReq: noSkillJob,
      prismaClient: client,
    });

    expect(matchScore.skillScore).toBe(0);
    expect(matchScore.score).toBeGreaterThan(0);
  });
});

