export type MatchScoringWeights = {
  skills: number;
  seniority: number;
  location: number;
  candidateSignals: number;
};

export type CandidateSignalWeights = {
  recentActivity: number;
  outreachInteractions: number;
  statusProgression: number;
};

export const MATCH_SCORING_WEIGHTS: MatchScoringWeights = {
  skills: 0.6,
  seniority: 0.15,
  location: 0.1,
  candidateSignals: 0.15,
};

export const CANDIDATE_SIGNAL_WEIGHTS: CandidateSignalWeights = {
  recentActivity: 0.4,
  outreachInteractions: 0.35,
  statusProgression: 0.25,
};

export function normalizeWeights<T extends Record<string, number>>(weights: T): T {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (total === 0) {
    return weights;
  }

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / total]),
  ) as T;
}
