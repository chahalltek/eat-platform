import { Candidate, CandidateSkill } from "@prisma/client";

import {
  CANDIDATE_CONFIDENCE_WEIGHTS,
  CandidateConfidenceWeights,
  normalizeWeights,
} from "@/lib/matching/scoringConfig";

type CandidateProfile = Candidate & {
  skills?: Array<Pick<CandidateSkill, "id">>;
};

type ScoreResult = { score: number; reason: string };

type ResumeCompletenessResult = ScoreResult & {
  completedFields: number;
  totalFields: number;
  missingFields: string[];
};

type CandidateConfidenceBreakdown = {
  sourceQuality: ScoreResult;
  agentConsistency: ScoreResult;
  resumeCompleteness: ResumeCompletenessResult;
};

export type CandidateConfidenceResult = {
  score: number;
  breakdown: CandidateConfidenceBreakdown;
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

function normalizeSourceValue(value?: string | null) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_") ?? "";
}

function scoreSourceQuality(candidate: CandidateProfile): ScoreResult {
  const sourceKey = normalizeSourceValue(candidate.sourceTag) || normalizeSourceValue(candidate.sourceType);

  const SOURCE_SCORES: Record<string, number> = {
    referral: 95,
    internal: 90,
    inbound: 85,
    sourced: 75,
    outbound: 75,
    job_board: 70,
    agency: 65,
  };

  const score = clampScore(sourceKey ? SOURCE_SCORES[sourceKey] ?? 65 : 55);

  const label = sourceKey || "unspecified source";
  const reason = sourceKey
    ? `Source quality derived from ${label.replace(/_/g, " ")}.`
    : "No source recorded; using conservative baseline.";

  return { score, reason };
}

function scoreAgentConsistency(candidate: CandidateProfile): ScoreResult {
  if (typeof candidate.parsingConfidence === "number") {
    const normalized = Math.max(0, Math.min(1, candidate.parsingConfidence));
    const score = clampScore(normalized * 100);
    return {
      score,
      reason: `Parsing confidence at ${(normalized * 100).toFixed(0)}% reflects agent consistency.`,
    };
  }

  return {
    score: 55,
    reason: "No parsing confidence available; defaulting to neutral consistency.",
  };
}

function scoreResumeCompleteness(candidate: CandidateProfile): ResumeCompletenessResult {
  const fields: Array<[string, unknown]> = [
    ["summary", candidate.summary?.trim()],
    ["raw resume", candidate.rawResumeText?.trim()],
    ["location", candidate.location?.trim()],
    ["current title", candidate.currentTitle?.trim()],
    ["email", candidate.email?.trim()],
    ["phone", candidate.phone?.trim()],
    ["skills", candidate.skills?.length ?? 0],
  ];

  const completedFields = fields.filter(([, value]) => {
    if (typeof value === "number") return value > 0;
    return Boolean(value);
  }).length;

  const totalFields = fields.length;
  const missingFields = fields
    .filter(([, value]) => {
      if (typeof value === "number") return value <= 0;
      return !value;
    })
    .map(([label]) => label);

  const completenessScore = clampScore((completedFields / totalFields) * 100);
  const reason =
    `Resume completeness covers ${completedFields} of ${totalFields} key fields` +
    (missingFields.length ? `; missing ${missingFields.join(", ")}.` : ".");

  return {
    score: completenessScore,
    completedFields,
    totalFields,
    missingFields,
    reason,
  };
}

export function computeCandidateConfidenceScore({
  candidate,
  weights = CANDIDATE_CONFIDENCE_WEIGHTS,
}: {
  candidate: CandidateProfile;
  weights?: CandidateConfidenceWeights;
}): CandidateConfidenceResult {
  const normalizedWeights = normalizeWeights(weights);

  const sourceQuality = scoreSourceQuality(candidate);
  const agentConsistency = scoreAgentConsistency(candidate);
  const resumeCompleteness = scoreResumeCompleteness(candidate);

  const score = clampScore(
    sourceQuality.score * normalizedWeights.sourceQuality +
      agentConsistency.score * normalizedWeights.agentConsistency +
      resumeCompleteness.score * normalizedWeights.resumeCompleteness,
  );

  return {
    score,
    breakdown: { sourceQuality, agentConsistency, resumeCompleteness },
  };
}
