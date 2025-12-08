import { normalizeWeights } from "@/lib/matching/scoringConfig";

export type RankerWeights = {
  matchScore: number;
  confidenceScore: number;
  recency: number;
  roleAlignment: number;
};

export type RankerCandidate = {
  id: string;
  matchScore: number;
  confidenceScore: number;
  recencyDays: number;
  roleAlignment: number;
};

export type RankedCandidate = RankerCandidate & {
  priorityScore: number;
  recencyScore: number;
};

export const RANKER_DEFAULT_WEIGHTS: RankerWeights = {
  matchScore: 0.45,
  confidenceScore: 0.2,
  recency: 0.2,
  roleAlignment: 0.15,
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const scoreRecency = (recencyDays: number) => {
  const safeDays = Math.max(0, recencyDays);
  const cappedDays = Math.min(safeDays, 180); // cap decay at ~6 months
  return clampScore(100 - (cappedDays / 180) * 100);
};

const weightedScore = (candidate: RankerCandidate, weights: RankerWeights) => {
  const normalizedWeights = normalizeWeights(weights);
  const recencyScore = scoreRecency(candidate.recencyDays);

  const priorityScore = clampScore(
    candidate.matchScore * normalizedWeights.matchScore +
      candidate.confidenceScore * normalizedWeights.confidenceScore +
      recencyScore * normalizedWeights.recency +
      candidate.roleAlignment * normalizedWeights.roleAlignment,
  );

  return { priorityScore, recencyScore };
};

const resolveTie = (a: RankedCandidate, b: RankedCandidate) => {
  if (a.recencyDays !== b.recencyDays) return a.recencyDays - b.recencyDays;
  if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
  if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
  if (b.roleAlignment !== a.roleAlignment) return b.roleAlignment - a.roleAlignment;
  return a.id.localeCompare(b.id);
};

export const rankCandidates = (
  candidates: RankerCandidate[],
  weights: RankerWeights = RANKER_DEFAULT_WEIGHTS,
): RankedCandidate[] => {
  const scored = candidates.map((candidate) => {
    const { priorityScore, recencyScore } = weightedScore(candidate, weights);
    return { ...candidate, priorityScore, recencyScore };
  });

  return scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return resolveTie(a, b);
  });
};
