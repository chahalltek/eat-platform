import { describe, expect, it } from "vitest";

import { computeMatchScore, type MatchContext } from "@/lib/matching/msa";
import { validateMatchExplanation } from "@/lib/matching/explanation";

const baseCandidate: MatchContext["candidate"] = {
  id: "candidate-1",
  fullName: "Casey Candidate",
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
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
  skills: [
    {
      id: "cand-skill-2",
      candidateId: "candidate-1",
      name: "TypeScript",
      normalizedName: "typescript",
      proficiency: "High",
      yearsOfExperience: 3,
    },
    {
      id: "cand-skill-1",
      candidateId: "candidate-1",
      name: "React",
      normalizedName: "react",
      proficiency: "High",
      yearsOfExperience: 4,
    },
  ],
};

const baseJob: MatchContext["jobReq"] = {
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
  skills: [
    {
      id: "job-skill-2",
      jobReqId: "job-1",
      name: "TypeScript",
      normalizedName: "typescript",
      required: false,
      weight: 1,
    },
    {
      id: "job-skill-1",
      jobReqId: "job-1",
      name: "React",
      normalizedName: "react",
      required: true,
      weight: 2,
    },
    {
      id: "job-skill-3",
      jobReqId: "job-1",
      name: "GraphQL",
      normalizedName: "graphql",
      required: true,
      weight: 1,
    },
  ],
  matchResults: [],
  matches: [],
  jobCandidates: [],
  outreachInteractions: [],
};

const candidateSignals = {
  score: 70,
  breakdown: {
    recentActivity: { score: 80, daysSinceActivity: 3, reason: "Recent activity 3 day(s) ago influences engagement." },
    outreachInteractions: { score: 70, interactions: 1, reason: "Outreach interactions recorded: 1." },
    statusProgression: { score: 65, status: "POTENTIAL", reason: "Current status POTENTIAL contributes to engagement." },
  },
  reasons: [
    "Recent activity 3 day(s) ago influences engagement.",
    "Outreach interactions recorded: 1.",
    "Current status POTENTIAL contributes to engagement.",
  ],
} as const;

describe("computeMatchScore explainability", () => {
  it("produces deterministic explanations", () => {
    const context: MatchContext = { candidate: baseCandidate, jobReq: baseJob };

    const first = computeMatchScore(context, { jobFreshnessScore: 85, candidateSignals });
    const second = computeMatchScore(context, { jobFreshnessScore: 85, candidateSignals });

    expect(first.explanation).toEqual(second.explanation);
  });

  it("matches the explanation schema", () => {
    const context: MatchContext = { candidate: baseCandidate, jobReq: baseJob };

    const result = computeMatchScore(context, { jobFreshnessScore: 85, candidateSignals });

    expect(validateMatchExplanation(result.explanation)).toBe(true);
    expect(result.explanation.topReasons.length).toBeGreaterThan(0);
    expect(result.explanation.exportableText).toContain("Top reasons:");
    expect(result.explanation.missingSkills).toContain("GraphQL");
    expect(result.explanation.riskAreas).toContain("Missing required skill: GraphQL");
  });
});
