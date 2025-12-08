import { TS_CONFIG } from "@/config/ts";

export type MatchScoringWeights = typeof TS_CONFIG.matcher.weight;

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

export const MATCH_SCORING_WEIGHTS: MatchScoringWeights = TS_CONFIG.matcher.weight;

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
