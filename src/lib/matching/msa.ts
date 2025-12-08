import { Candidate, CandidateSkill, JobReq, JobSkill } from '@prisma/client';

import { CandidateSignalResult } from '@/lib/matching/candidateSignals';
import { MatchExplanation, SkillOverlap, makeDeterministicExplanation } from '@/lib/matching/explanation';
import { MATCH_SCORING_WEIGHTS, normalizeWeights } from '@/lib/matching/scoringConfig';

export type MatchContext = {
  candidate: Candidate & { skills: CandidateSkill[] };
  jobReq: JobReq & { skills: JobSkill[] };
};

export type MatchScore = {
  score: number;
  jobFreshnessScore: number;
  skillScore: number;
  seniorityScore: number;
  locationScore: number;
  candidateSignalScore?: number;
  candidateSignalBreakdown?: CandidateSignalResult['breakdown'];
  reasons: string[];
  explanation: MatchExplanation;
};

const normalize = (value?: string | null): string => value?.trim().toLowerCase() ?? '';

const getSkillKey = (skill: CandidateSkill | JobSkill): string => {
  if ('normalizedName' in skill && skill.normalizedName) {
    return normalize(skill.normalizedName);
  }

  return normalize(skill.name);
};

export function computeMatchScore(
  ctx: MatchContext,
  options?: { jobFreshnessScore?: number; candidateSignals?: CandidateSignalResult },
): MatchScore {
  const reasons: string[] = [];
  const riskAreas: string[] = [];

  const candidateSkillMap = new Map<string, CandidateSkill>();
  ctx.candidate.skills
    .slice()
    .sort((a, b) => getSkillKey(a).localeCompare(getSkillKey(b)))
    .forEach((skill) => {
      const key = getSkillKey(skill);
      if (key) {
        candidateSkillMap.set(key, skill);
      }
    });

  let matchedSkillWeight = 0;
  let totalSkillWeight = 0;

  const skillOverlapMap: SkillOverlap[] = [];
  let requiredTotal = 0;
  let requiredMatched = 0;
  let preferredTotal = 0;
  let preferredMatched = 0;

  ctx.jobReq.skills
    .slice()
    .sort((a, b) => getSkillKey(a).localeCompare(getSkillKey(b)))
    .forEach((jobSkill) => {
      const key = getSkillKey(jobSkill);
      const weight = jobSkill.weight ?? (jobSkill.required ? 2 : 1);
      if (!key || weight <= 0) {
        return;
      }

      totalSkillWeight += weight;
      const isRequired = Boolean(jobSkill.required);
      if (isRequired) {
        requiredTotal += 1;
      } else {
        preferredTotal += 1;
      }

      const candidateSkill = candidateSkillMap.get(key);
      if (candidateSkill) {
        matchedSkillWeight += weight;
        if (isRequired) {
          requiredMatched += 1;
        } else {
          preferredMatched += 1;
        }

        reasons.push(
          `${jobSkill.required ? 'Required' : 'Nice-to-have'} skill matched: ${jobSkill.name}`,
        );
        skillOverlapMap.push({
          skill: jobSkill.name,
          status: 'matched',
          importance: jobSkill.required ? 'required' : 'preferred',
          weight,
          note: `${jobSkill.name} aligns with candidate skill ${candidateSkill.name}`,
        });
      } else {
        const reason = jobSkill.required
          ? `Missing required skill: ${jobSkill.name}`
          : `Missing nice-to-have skill: ${jobSkill.name}`;
        reasons.push(reason);
        if (jobSkill.required) {
          riskAreas.push(reason);
        }
        skillOverlapMap.push({
          skill: jobSkill.name,
          status: 'missing',
          importance: jobSkill.required ? 'required' : 'preferred',
          weight,
          note: reason,
        });
      }
    });

  const skillScore = totalSkillWeight > 0 ? Math.round((matchedSkillWeight / totalSkillWeight) * 100) : 0;

  const candidateSeniority = normalize(ctx.candidate.seniorityLevel);
  const jobSeniority = normalize(ctx.jobReq.seniorityLevel);

  let seniorityScore = 50;
  if (!candidateSeniority || !jobSeniority) {
    const reason = 'Seniority comparison is limited due to missing data';
    reasons.push(reason);
    riskAreas.push(reason);
  } else if (candidateSeniority === jobSeniority) {
    seniorityScore = 100;
    reasons.push(`Seniority aligns: ${ctx.candidate.seniorityLevel}`);
  } else {
    seniorityScore = 0;
    const reason = `Seniority mismatch: candidate is ${ctx.candidate.seniorityLevel}, job requires ${ctx.jobReq.seniorityLevel}`;
    reasons.push(reason);
    riskAreas.push(reason);
  }

  const candidateLocation = normalize(ctx.candidate.location);
  const jobLocation = normalize(ctx.jobReq.location);

  let locationScore = 50;
  if (!candidateLocation || !jobLocation) {
    const reason = 'Location comparison is limited due to missing data';
    reasons.push(reason);
    riskAreas.push(reason);
  } else if (candidateLocation === jobLocation) {
    locationScore = 100;
    reasons.push(`Location matches: ${ctx.candidate.location}`);
  } else {
    locationScore = 0;
    const reason = `Location mismatch: candidate in ${ctx.candidate.location}, job in ${ctx.jobReq.location}`;
    reasons.push(reason);
    riskAreas.push(reason);
  }

  const normalizedWeights = normalizeWeights(MATCH_SCORING_WEIGHTS);

  const candidateSignals = options?.candidateSignals;
  const candidateSignalScore = candidateSignals?.score ?? 50;

  const baseScore = Math.round(
    skillScore * normalizedWeights.skills +
      seniorityScore * normalizedWeights.seniority +
      locationScore * normalizedWeights.location +
      candidateSignalScore * normalizedWeights.candidateSignals,
  );

  if (candidateSignals) {
    reasons.push(...candidateSignals.reasons);
  } else {
    reasons.push('Limited engagement signals available; using neutral weighting.');
  }

  const jobFreshnessScore = Math.round(options?.jobFreshnessScore ?? 100);

  let score = baseScore;
  if (options?.jobFreshnessScore !== undefined) {
    if (jobFreshnessScore < 100) {
      reasons.push(`Job freshness adjustment applied (${jobFreshnessScore}/100).`);
    }
    score = Math.round(baseScore * 0.85 + jobFreshnessScore * 0.15);
  }

  const topReasons = reasons.slice(0, 5);
  const totalRequiredText = `${requiredMatched}/${requiredTotal || 0} required skills matched`;
  const totalPreferredText = `${preferredMatched}/${preferredTotal || 0} preferred skills matched`;
  const riskSummary = riskAreas.length > 0 ? riskAreas.join('; ') : 'No major risks detected.';

  const rawExplanation: MatchExplanation = {
    topReasons,
    allReasons: reasons,
    skillOverlapMap,
    riskAreas,
    exportableText: [
      `Top reasons: ${topReasons.join('; ') || 'None'}.`,
      `Skill overlap: ${totalRequiredText}; ${totalPreferredText}.`,
      `Risk areas: ${riskSummary}`,
      `Overall score: ${score} / 100.`,
    ].join(' '),
  };

  const explanation = makeDeterministicExplanation(rawExplanation);

  return {
    score,
    jobFreshnessScore,
    skillScore,
    seniorityScore,
    locationScore,
    candidateSignalScore,
    candidateSignalBreakdown: candidateSignals?.breakdown,
    reasons: explanation.allReasons,
    explanation,
  };
}
