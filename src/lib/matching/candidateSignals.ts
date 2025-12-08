import { Candidate, JobCandidate, JobCandidateStatus } from "@prisma/client";

import {
  CANDIDATE_SIGNAL_WEIGHTS,
  CandidateSignalWeights,
  normalizeWeights,
} from "@/lib/matching/scoringConfig";

export type CandidateSignalBreakdown = {
  recentActivity: { score: number; daysSinceActivity: number | null; reason: string };
  outreachInteractions: { score: number; interactions: number; reason: string };
  statusProgression: { score: number; status: JobCandidateStatus | "UNASSIGNED"; reason: string };
};

export type CandidateSignalResult = {
  score: number;
  breakdown: CandidateSignalBreakdown;
  reasons: string[];
};

type CandidateSignalInput = {
  candidate: Candidate;
  jobCandidate?: JobCandidate | null;
  outreachInteractions?: number;
  weights?: CandidateSignalWeights;
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

function scoreRecentActivity(candidate: Candidate, jobCandidate?: JobCandidate | null) {
  const activityDate = jobCandidate?.updatedAt ?? candidate.updatedAt ?? candidate.createdAt;
  if (!activityDate) {
    return {
      score: 50,
      daysSinceActivity: null,
      reason: "No recent activity available; using neutral score.",
    };
  }

  const daysSinceActivity = Math.max(
    0,
    Math.round((Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  let score = 35;
  if (daysSinceActivity <= 7) {
    score = 100;
  } else if (daysSinceActivity <= 30) {
    score = 85;
  } else if (daysSinceActivity <= 90) {
    score = 70;
  } else if (daysSinceActivity <= 180) {
    score = 55;
  }

  return {
    score,
    daysSinceActivity,
    reason: `Recent activity ${daysSinceActivity} day(s) ago influences engagement.`,
  };
}

function scoreOutreach(interactions = 0) {
  let score = 30;
  if (interactions >= 5) {
    score = 100;
  } else if (interactions >= 3) {
    score = 85;
  } else if (interactions >= 1) {
    score = 70;
  }

  const reason =
    interactions > 0
      ? `Outreach interactions recorded: ${interactions}.`
      : "No outreach interactions recorded yet.";

  return { score, interactions, reason };
}

const STATUS_SCORE: Record<JobCandidateStatus, number> = {
  [JobCandidateStatus.POTENTIAL]: 40,
  [JobCandidateStatus.SHORTLISTED]: 65,
  [JobCandidateStatus.SUBMITTED]: 75,
  [JobCandidateStatus.INTERVIEWING]: 90,
  [JobCandidateStatus.HIRED]: 100,
  [JobCandidateStatus.REJECTED]: 20,
};

function scoreStatus(jobCandidate?: JobCandidate | null) {
  if (!jobCandidate) {
    return {
      score: 45,
      status: "UNASSIGNED" as const,
      reason: "No job-specific status yet; using neutral signal.",
    };
  }

  const score = STATUS_SCORE[jobCandidate.status] ?? 45;
  const reason = `Current status ${jobCandidate.status} contributes to engagement.`;

  return { score, status: jobCandidate.status, reason };
}

export function computeCandidateSignalScore({
  candidate,
  jobCandidate,
  outreachInteractions = 0,
  weights = CANDIDATE_SIGNAL_WEIGHTS,
}: CandidateSignalInput): CandidateSignalResult {
  const normalizedWeights = normalizeWeights(weights);

  const recentActivity = scoreRecentActivity(candidate, jobCandidate);
  const outreach = scoreOutreach(outreachInteractions);
  const status = scoreStatus(jobCandidate);

  const score = clampScore(
    recentActivity.score * normalizedWeights.recentActivity +
      outreach.score * normalizedWeights.outreachInteractions +
      status.score * normalizedWeights.statusProgression,
  );

  const breakdown: CandidateSignalBreakdown = {
    recentActivity,
    outreachInteractions: outreach,
    statusProgression: status,
  };

  return {
    score,
    breakdown,
    reasons: [recentActivity.reason, outreach.reason, status.reason],
  };
}
