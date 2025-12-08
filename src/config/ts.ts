export const TS_CONFIG = {
<<<<<<< ours
  matcher: {
    minScore: 65,
    weight: {
      skills: 0.5,
      experience: 0.3,
      location: 0.1,
      tenure: 0.1,
    },
  },

  confidence: {
    dataCompletenessWeight: 0.4,
    skillOverlapWeight: 0.4,
    recencyWeight: 0.2,
    passingScore: 70,
  },

  shortlist: {
    topN: 5,
    minMatchScore: 70,
    minConfidence: 65,
  },

  explain: {
    enabled: true,
  },
} as const;
=======
  shortlist: {
    minMatchScore: 60,
    minConfidence: 50,
    topN: 5,
  },
} as const;

export type TsConfig = typeof TS_CONFIG;
>>>>>>> theirs
