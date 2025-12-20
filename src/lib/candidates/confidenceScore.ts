import { Candidate, CandidateSkill } from "@/server/db/prisma";

import { prisma } from "@/server/db/prisma";

import {
  CANDIDATE_CONFIDENCE_WEIGHTS,
  CandidateConfidenceWeights,
  normalizeWeights,
} from "@/lib/matching/scoringConfig";

type CandidateProfile = Candidate & {
  skills?: Array<Pick<CandidateSkill, "id" | "name" | "proficiency" | "yearsOfExperience">>;
};

type ScoreResult = { score: number; reason: string };

type ResumeCompletenessResult = ScoreResult & {
  completedFields: number;
  totalFields: number;
  missingFields: string[];
};

type SkillCoverageResult = ScoreResult & {
  recordedSkills: number;
  skillsWithDepth: number;
};

type UnknownFieldsResult = ScoreResult & {
  unknownFieldLabels: string[];
};

type CandidateConfidenceBreakdown = {
  resumeCompleteness: ResumeCompletenessResult;
  skillCoverage: SkillCoverageResult;
  agentAgreement: ScoreResult;
  unknownFields: UnknownFieldsResult;
};

export type CandidateConfidenceResult = {
  score: number;
  breakdown: CandidateConfidenceBreakdown;
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

function scoreAgentAgreement(candidate: CandidateProfile): ScoreResult {
  if (typeof candidate.parsingConfidence === "number") {
    const normalized = Math.max(0, Math.min(1, candidate.parsingConfidence));
    const score = clampScore(normalized * 100);
    return {
      score,
      reason: `Agent parsing confidence at ${(normalized * 100).toFixed(0)}% indicates agreement across runs.`,
    };
  }

  return {
    score: 60,
    reason: "No parsing confidence available; using neutral agent agreement.",
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

function scoreSkillCoverage(candidate: CandidateProfile): SkillCoverageResult {
  const skills = candidate.skills ?? [];
  const recordedSkills = skills.length;
  const skillsWithDepth = skills.filter((skill) => skill.proficiency || typeof skill.yearsOfExperience === "number").length;

  if (recordedSkills === 0) {
    return {
      score: 30,
      recordedSkills,
      skillsWithDepth,
      reason: "No skills recorded; confidence relies on other signals.",
    };
  }

  const coveragePortion = Math.min(recordedSkills, 8) / 8; // encourage a healthy breadth without over-weighting extremes
  const depthPortion = skillsWithDepth / recordedSkills;

  const baseScore = coveragePortion * 70 + depthPortion * 30;
  const depthBonus = recordedSkills >= 4 && skillsWithDepth / recordedSkills >= 0.75 ? 10 : 0;
  const score = clampScore(baseScore + depthBonus);
  const reason =
    `Skills coverage includes ${recordedSkills} skill${recordedSkills === 1 ? "" : "s"}` +
    (skillsWithDepth
      ? ` with depth on ${skillsWithDepth}${depthBonus ? "; strong coverage boosts confidence" : ""}.`
      : "; add proficiency or experience for more confidence.");

  return { score, recordedSkills, skillsWithDepth, reason };
}

function scoreUnknownFields(candidate: CandidateProfile): UnknownFieldsResult {
  const UNKNOWN_PATTERN = /\b(?:unknown|n\/a|na|not provided|unspecified)\b/i;
  const fields: Array<[string, unknown]> = [
    ["full name", candidate.fullName],
    ["summary", candidate.summary],
    ["location", candidate.location],
    ["current title", candidate.currentTitle],
    ["email", candidate.email],
    ["phone", candidate.phone],
    ["source type", candidate.sourceType],
    ["source tag", candidate.sourceTag],
  ];

  const unknownFieldLabels = fields
    .filter(([, value]) => typeof value === "string" && UNKNOWN_PATTERN.test(value))
    .map(([label]) => label);

  const penalty = unknownFieldLabels.length * 15;
  const score = clampScore(100 - penalty);
  const reason =
    unknownFieldLabels.length === 0
      ? "No fields marked as unknown or unspecified."
      : `Detected ${unknownFieldLabels.length} unknown field${unknownFieldLabels.length === 1 ? "" : "s"}: ${unknownFieldLabels.join(", ")}.`;

  return { score, unknownFieldLabels, reason };
}

export function computeCandidateConfidenceScore({
  candidate,
  weights = CANDIDATE_CONFIDENCE_WEIGHTS,
}: {
  candidate: CandidateProfile;
  weights?: CandidateConfidenceWeights;
}): CandidateConfidenceResult {
  const normalizedWeights = normalizeWeights(weights);

  const resumeCompleteness = scoreResumeCompleteness(candidate);
  const skillCoverage = scoreSkillCoverage(candidate);
  const agentAgreement = scoreAgentAgreement(candidate);
  const unknownFields = scoreUnknownFields(candidate);

  const score = clampScore(
    resumeCompleteness.score * normalizedWeights.resumeCompleteness +
      skillCoverage.score * normalizedWeights.skillCoverage +
      agentAgreement.score * normalizedWeights.agentAgreement +
      unknownFields.score * normalizedWeights.unknownFields,
  );

  return {
    score,
    breakdown: { resumeCompleteness, skillCoverage, agentAgreement, unknownFields },
  };
}

export async function persistCandidateConfidenceScore({
  candidateId,
  candidate,
  weights,
}: {
  candidateId: string;
  candidate?: CandidateProfile;
  weights?: CandidateConfidenceWeights;
}): Promise<CandidateConfidenceResult> {
  const candidateProfile =
    candidate ??
    (await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { skills: { select: { id: true, name: true, proficiency: true, yearsOfExperience: true } } },
    }));

  if (!candidateProfile) {
    throw new Error(`Candidate ${candidateId} not found for confidence scoring.`);
  }

  const result = computeCandidateConfidenceScore({ candidate: candidateProfile, weights });

  await prisma.candidate.update({
    where: { id: candidateProfile.id },
    data: { trustScore: result.score },
  });

  return result;
}
