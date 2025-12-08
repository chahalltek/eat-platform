import { MATCH_SCORING_WEIGHTS } from "@/lib/matching/scoringConfig";

export type TsConfig = {
  matcher: {
    minScore: number;
    weights: typeof MATCH_SCORING_WEIGHTS;
  };
  shortlist: {
    minMatchScore: number;
    minConfidence: number;
    topN: number;
  };
  confidence: {
    passingScore: number;
  };
};

export const TS_CONFIG: TsConfig = {
  matcher: {
    minScore: 60,
    weights: MATCH_SCORING_WEIGHTS,
  },
  shortlist: {
    minMatchScore: 60,
    minConfidence: 50,
    topN: 5,
  },
  confidence: {
    passingScore: 60,
  },
};
