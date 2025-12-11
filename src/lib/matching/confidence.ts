import { Candidate, CandidateSkill, JobReq, JobSkill } from "@prisma/client";

import { DEFAULT_TENANT_CONFIG } from "@/lib/config/tenantConfig";
import { computeConfidenceScore, ConfidenceBreakdown } from "@/lib/confidence/scoring";

export type MatchConfidenceCategory = "HIGH" | "MEDIUM" | "LOW";

export type MatchConfidence = {
  score: number;
  category: MatchConfidenceCategory;
  reasons: string[];
  breakdown: ConfidenceBreakdown;
};

type MatchConfidenceContext = {
  candidate: Candidate & { skills: CandidateSkill[] };
  jobReq: JobReq & { skills: JobSkill[] };
};

const determineCategory = (
  score: number,
  thresholds = DEFAULT_TENANT_CONFIG.scoring.confidence.thresholds,
): MatchConfidenceCategory => {
  if (score >= thresholds.high) return "HIGH";
  if (score >= thresholds.medium) return "MEDIUM";
  return "LOW";
};

const buildReasons = (
  ctx: MatchConfidenceContext,
  breakdown: ConfidenceBreakdown,
  category: MatchConfidenceCategory,
): string[] => {
  const hasTitle = Boolean(ctx.candidate.currentTitle?.trim());
  const hasLocation = Boolean(ctx.candidate.location?.trim());
  const candidateSkillCount = ctx.candidate.skills.length;
  const jobSkillCount = ctx.jobReq.skills.length;
  const recencySource = ctx.candidate.updatedAt ?? ctx.candidate.createdAt;

  const reasons: string[] = [];

  reasons.push(
    hasTitle
      ? "Candidate title present improves data completeness."
      : "Missing candidate title reduces data completeness.",
  );

  reasons.push(
    hasLocation
      ? "Candidate location recorded supports location-aware confidence."
      : "Missing candidate location lowers location confidence.",
  );

  reasons.push(
    `Skill overlap contributes ${breakdown.skillCoverage}/40 from ${candidateSkillCount} candidate skill(s) against ${jobSkillCount} job skill(s).`,
  );

  if (recencySource) {
    reasons.push(
      `Profile recency contributes ${breakdown.recency}/20 (last updated ${recencySource.toISOString().split("T")[0]}).`,
    );
  } else {
    reasons.push(`Profile recency contributes ${breakdown.recency}/20 (no recent update available).`);
  }

  reasons.push(`Overall confidence categorized as ${category}.`);

  return reasons;
};

export function computeMatchConfidence(
  {
    candidate,
    jobReq,
  }: MatchConfidenceContext,
  config = DEFAULT_TENANT_CONFIG.scoring.confidence,
): MatchConfidence {
  const jobSkills = jobReq.skills.map((skill) => skill.normalizedName || skill.name);
  const candidateSkills = candidate.skills.map((skill) => skill.normalizedName || skill.name);
  const hasTitle = Boolean(candidate.currentTitle?.trim());
  const hasLocation = Boolean(candidate.location?.trim());
  const createdAt = candidate.updatedAt ?? candidate.createdAt ?? null;

  const breakdown = computeConfidenceScore({
    jobSkills,
    candidateSkills,
    hasTitle,
    hasLocation,
    createdAt,
  });

  const thresholds = config.thresholds ?? DEFAULT_TENANT_CONFIG.scoring.confidence.thresholds;
  const category = determineCategory(breakdown.total >= 0 ? breakdown.total : 0, thresholds);
  const reasons = buildReasons({ candidate, jobReq }, breakdown, category);

  return { score: breakdown.total, category, reasons, breakdown };
}
