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

export type CandidateConfidenceWeights = {
  resumeCompleteness: number;
  skillCoverage: number;
  agentAgreement: number;
  unknownFields: number;
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

export const CANDIDATE_CONFIDENCE_WEIGHTS: CandidateConfidenceWeights = {
  resumeCompleteness: 0.35,
  skillCoverage: 0.25,
  agentAgreement: 0.25,
  unknownFields: 0.15,
};

export function normalizeWeights<T extends Record<string, number>>(weights: T): T {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

  if (total === 0) {
    const keys = Object.keys(weights);
    if (keys.length === 0) return weights;

    const equalWeight = 1 / keys.length;
    return Object.fromEntries(keys.map((key) => [key, equalWeight])) as T;
  }

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / total]),
  ) as T;
}
