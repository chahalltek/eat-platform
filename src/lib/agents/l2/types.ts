export type L2Question =
  | "RISKIEST_REQS"
  | "SCARCITY_HOTSPOTS"
  | "PRESET_RECOMMENDATIONS"
  | "HIRING_VELOCITY_ALERTS";

export type L2Input = {
  tenantId: string;
  scope?: {
    roleFamily?: string;
    region?: string;
    industry?: string;
    horizonDays?: 30 | 60 | 90;
  };
};

export type L2Result = {
  question: L2Question;
  generatedAt: string;
  items: Array<{
    title: string;
    score: number; // ranking score
    rationale: string[];
    references: Array<{ type: string; id?: string; label: string }>;
  }>;
};
