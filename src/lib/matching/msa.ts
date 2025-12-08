import { Candidate, CandidateSkill, JobReq, JobSkill } from '@prisma/client';

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
  reasons: string[];
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
  options?: { jobFreshnessScore?: number },
): MatchScore {
  const reasons: string[] = [];

  const candidateSkillMap = new Map<string, CandidateSkill>();
  ctx.candidate.skills.forEach((skill) => {
    const key = getSkillKey(skill);
    if (key) {
      candidateSkillMap.set(key, skill);
    }
  });

  let matchedSkillWeight = 0;
  let totalSkillWeight = 0;

  ctx.jobReq.skills.forEach((jobSkill) => {
    const key = getSkillKey(jobSkill);
    const weight = jobSkill.weight ?? (jobSkill.required ? 2 : 1);
    if (!key || weight <= 0) {
      return;
    }

    totalSkillWeight += weight;

    const candidateSkill = candidateSkillMap.get(key);
    if (candidateSkill) {
      matchedSkillWeight += weight;
      reasons.push(
        `${jobSkill.required ? 'Required' : 'Nice-to-have'} skill matched: ${jobSkill.name}`,
      );
    } else if (jobSkill.required) {
      reasons.push(`Missing required skill: ${jobSkill.name}`);
    } else {
      reasons.push(`Missing nice-to-have skill: ${jobSkill.name}`);
    }
  });

  const skillScore = totalSkillWeight > 0 ? Math.round((matchedSkillWeight / totalSkillWeight) * 100) : 0;

  const candidateSeniority = normalize(ctx.candidate.seniorityLevel);
  const jobSeniority = normalize(ctx.jobReq.seniorityLevel);

  let seniorityScore = 50;
  if (!candidateSeniority || !jobSeniority) {
    reasons.push('Seniority comparison is limited due to missing data');
  } else if (candidateSeniority === jobSeniority) {
    seniorityScore = 100;
    reasons.push(`Seniority aligns: ${ctx.candidate.seniorityLevel}`);
  } else {
    seniorityScore = 0;
    reasons.push(`Seniority mismatch: candidate is ${ctx.candidate.seniorityLevel}, job requires ${ctx.jobReq.seniorityLevel}`);
  }

  const candidateLocation = normalize(ctx.candidate.location);
  const jobLocation = normalize(ctx.jobReq.location);

  let locationScore = 50;
  if (!candidateLocation || !jobLocation) {
    reasons.push('Location comparison is limited due to missing data');
  } else if (candidateLocation === jobLocation) {
    locationScore = 100;
    reasons.push(`Location matches: ${ctx.candidate.location}`);
  } else {
    locationScore = 0;
    reasons.push(`Location mismatch: candidate in ${ctx.candidate.location}, job in ${ctx.jobReq.location}`);
  }

  const baseScore = Math.round(skillScore * 0.7 + seniorityScore * 0.2 + locationScore * 0.1);

  const jobFreshnessScore = Math.round(options?.jobFreshnessScore ?? 100);

  if (jobFreshnessScore < 100) {
    reasons.push(`Job freshness adjustment applied (${jobFreshnessScore}/100).`);
  }

  const score = Math.round(baseScore * 0.85 + jobFreshnessScore * 0.15);

  return {
    score,
    jobFreshnessScore,
    skillScore,
    seniorityScore,
    locationScore,
    reasons,
  };
}
