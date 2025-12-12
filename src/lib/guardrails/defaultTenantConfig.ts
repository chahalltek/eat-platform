export const defaultTenantGuardrails = {
  scoring: {
    strategy: "weighted" as const, // "simple" | "weighted"
    weights: {
      mustHaveSkills: 0.4,
      niceToHaveSkills: 0.2,
      experience: 0.25,
      location: 0.15,
    },
    thresholds: {
      minMatchScore: 0.55,
      shortlistMinScore: 0.65,
      shortlistMaxCandidates: 5,
    },
  },
  explain: {
    level: "compact" as const, // "compact" | "detailed"
    includeWeights: false,
  },
  safety: {
    requireMustHaves: true,
    excludeInternalCandidates: false,
    confidenceBands: { high: 0.75, medium: 0.55 },
  },
};
