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
   shortlist: {
    strategy: "quality" as const,
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
  llm: {
    provider: "openai" as const,
    model: "gpt-4.1-mini",
    allowedAgents: ["EXPLAIN", "RINA", "RUA", "OUTREACH", "INTAKE"],
    maxTokens: 600,
    verbosityCap: 2000,
  },
  networkLearning: {
    enabled: false,
  },
};
