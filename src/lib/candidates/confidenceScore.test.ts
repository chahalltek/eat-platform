import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  candidate: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { computeCandidateConfidenceScore, persistCandidateConfidenceScore } from "./confidenceScore";

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

  it("keeps scores within bounds for extreme data", () => {
    const result = computeCandidateConfidenceScore({
      candidate: {
        ...baseCandidate,
        parsingConfidence: 10,
        rawResumeText: "",
        summary: "",
        location: "",
        currentTitle: "",
        email: "",
        phone: "",
        skills: [],
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("is deterministic for identical candidates", () => {
    const first = computeCandidateConfidenceScore({ candidate: baseCandidate });
    const second = computeCandidateConfidenceScore({ candidate: { ...baseCandidate } });

    expect(second.score).toBe(first.score);
    expect(second.breakdown).toEqual(first.breakdown);
  });

  it("handles missing data by reducing completeness but not failing", () => {
    const result = computeCandidateConfidenceScore({
      candidate: {
        ...baseCandidate,
        rawResumeText: "",
        summary: "",
        skills: [],
        parsingConfidence: undefined,
      },
    });

    expect(result.breakdown.resumeCompleteness.completedFields).toBeLessThan(
      result.breakdown.resumeCompleteness.totalFields,
    );
    expect(result.breakdown.skillCoverage.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
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

describe("persistCandidateConfidenceScore", () => {
  it("computes and stores deterministic trust score", async () => {
    vi.mocked(prismaMock.candidate.findUnique).mockResolvedValue({ ...baseCandidate } as any);
    vi.mocked(prismaMock.candidate.update).mockResolvedValue({ ...baseCandidate } as any);

    const first = await persistCandidateConfidenceScore({ candidateId: baseCandidate.id });
    const second = await persistCandidateConfidenceScore({ candidateId: baseCandidate.id });

    expect(first.score).toBe(second.score);
    expect(prismaMock.candidate.update).toHaveBeenCalledWith({
      where: { id: baseCandidate.id },
      data: { trustScore: first.score },
    });
  });

  it("throws when candidate data is missing", async () => {
    vi.mocked(prismaMock.candidate.findUnique).mockResolvedValueOnce(null as any);

    await expect(
      persistCandidateConfidenceScore({ candidateId: "missing-candidate" }),
    ).rejects.toThrow(/not found/);
  });
});
