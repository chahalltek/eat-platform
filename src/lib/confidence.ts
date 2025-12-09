import type { CandidateProfile } from './contracts/candidateProfile';
import type { JobIntakeProfile } from './contracts/jobIntake';
import type { MatchScoreBreakdown } from './matching/scoring';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalize(str?: string | null): string | null {
  return str?.trim().toLowerCase() ?? null;
}

function evaluateRequiredSkills(job: JobIntakeProfile, candidate: CandidateProfile) {
  const requiredSkills = job.skills?.filter(skill => skill.required) ?? [];
  const candidateSkillSet = new Set(
    (candidate.normalizedSkills ?? [])
      .map(skill => normalize(skill.normalizedName))
      .filter((name): name is string => Boolean(name)),
  );

  const matchedRequired = requiredSkills.filter(skill => {
    const normalizedName = normalize(skill.normalizedName);
    return normalizedName ? candidateSkillSet.has(normalizedName) : false;
  }).length;
  const requiredCoverage = requiredSkills.length === 0 ? 1 : matchedRequired / requiredSkills.length;
  return { requiredSkills, matchedRequired, requiredCoverage };
}

function evaluateSeniority(job: JobIntakeProfile, candidate: CandidateProfile) {
  const jobSeniority = normalize(job.seniorityLevel);
  const candidateSeniority = normalize(candidate.seniorityLevel);

  if (!jobSeniority && !candidateSeniority) {
    return { score: 0.5, reason: 'Seniority unspecified; neutral confidence applied.' };
  }

  if (jobSeniority && candidateSeniority) {
    if (jobSeniority === candidateSeniority) {
      return { score: 1, reason: 'Candidate seniority matches job requirement.' };
    }
    return {
      score: 0.5,
      reason: `Seniority differs (job: ${jobSeniority}, candidate: ${candidateSeniority}); lowering confidence.`,
    };
  }

  // One side missing
  return {
    score: 0.7,
    reason: 'Partial seniority data; modest confidence applied.',
  };
}

function completenessScore(candidate: CandidateProfile) {
  const fields: Array<[string, unknown]> = [
    ['full name', candidate.fullName],
    ['location', candidate.location],
    ['current title', candidate.currentTitle],
    ['contact', candidate.email || candidate.phone],
    ['skills', candidate.normalizedSkills?.length ?? 0],
    ['summary', candidate.summary],
  ];

  const present = fields.filter(([, value]) => {
    if (typeof value === 'number') return value > 0;
    return Boolean(value && `${value}`.trim());
  }).length;

  const ratio = present / fields.length;
  const missing = fields
    .filter(([, value]) => {
      if (typeof value === 'number') return value <= 0;
      return !value || !`${value}`.trim();
    })
    .map(([label]) => label);

  return { ratio, missing };
}

function contradictionPenalty(job: JobIntakeProfile, candidate: CandidateProfile) {
  let penalty = 0;
  const reasons: string[] = [];

  const jobSeniority = normalize(job.seniorityLevel);
  const candidateSeniority = normalize(candidate.seniorityLevel);
  if (jobSeniority && candidateSeniority && jobSeniority !== candidateSeniority) {
    penalty += 7;
    reasons.push('Candidate seniority conflicts with job requirement.');
  }

  if ((candidate.normalizedSkills?.length ?? 0) === 0) {
    penalty += 8;
    reasons.push('No candidate skills provided.');
  }

  if (!candidate.fullName) {
    penalty += 5;
    reasons.push('Candidate name missing.');
  }

  return { penalty, reasons };
}

export function computeConfidence(
  match: MatchScoreBreakdown,
  job: JobIntakeProfile,
  candidate: CandidateProfile,
): { confidenceScore: number; reasons: string[] } {
  const reasons: string[] = [];

  const { requiredSkills, matchedRequired, requiredCoverage } = evaluateRequiredSkills(job, candidate);
  const overlapFactor = match.skillOverlapScore / 100;
  const skillCoverageScore = clamp(((requiredCoverage + overlapFactor) / 2) * 40, 0, 40);
  if (requiredSkills.length) {
    reasons.push(
      `Matched ${matchedRequired}/${requiredSkills.length} required skills (${Math.round(requiredCoverage * 100)}% coverage).`,
    );
  } else {
    reasons.push('No explicit required skills; relying on general skill overlap.');
  }

  const seniorityResult = evaluateSeniority(job, candidate);
  const seniorityScore = clamp(seniorityResult.score * 20, 0, 20);
  reasons.push(seniorityResult.reason);

  const completeness = completenessScore(candidate);
  const completenessScoreValue = clamp(completeness.ratio * 25, 0, 25);
  reasons.push(
    completeness.missing.length
      ? `Candidate profile missing ${completeness.missing.join(', ')}.`
      : 'Candidate profile is largely complete.',
  );

  const { penalty, reasons: penaltyReasons } = contradictionPenalty(job, candidate);
  if (penaltyReasons.length) {
    reasons.push(...penaltyReasons);
  }

  const baseScore = skillCoverageScore + seniorityScore + completenessScoreValue + clamp(match.compositeScore * 0.15, 0, 15);
  const confidenceScore = clamp(baseScore - penalty, 0, 100);

  return { confidenceScore, reasons };
}
