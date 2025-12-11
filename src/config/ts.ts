const BASE_WEIGHTS = {
  skills: 0.5,
  seniority: 0.3,
  location: 0.1,
  candidateSignals: 0.1,
} as const;

export const TS_CONFIG = {
  matcher: {
    minScore: 65,
    weight: BASE_WEIGHTS,
  },

  confidence: {
    dataCompletenessWeight: 0.4,
    skillOverlapWeight: 0.4,
    recencyWeight: 0.2,
    passingScore: 70,
    thresholds: {
      high: 75,
      medium: 50,
    },
  },

  shortlist: {
    topN: 5,
    minMatchScore: 70,
    minConfidence: 65,
  },

  explain: {
    enabled: true,
  },

  scoring: {
    matcher: {
      mode: "weighted" as const,
      minScore: 65,
      weights: BASE_WEIGHTS,
    },
    confidence: {
      thresholds: {
        high: 75,
        medium: 50,
      },
    },
  },

  msa: {
    matcher: {
      explain: true,
    },
  },
} as const;

export type TsConfig = typeof TS_CONFIG;
