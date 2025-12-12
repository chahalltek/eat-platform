export type GuardrailsPresetName = "conservative" | "balanced" | "aggressive";

type ConfidenceBands = { high: number; medium: number };

export type ShortlistStrategy = "quality" | "diversity" | "fast" | "strict";

export type GuardrailsConfig = {
  scoring: Record<string, unknown>;
  explain: Record<string, unknown>;
  safety: { confidenceBands?: ConfidenceBands } & Record<string, unknown>;
  shortlist?: { strategy?: ShortlistStrategy; maxCandidates?: number } & Record<string, unknown>;
};

export const guardrailsPresets: Record<GuardrailsPresetName, GuardrailsConfig> = {
  conservative: {
    scoring: {
      strategy: "weighted",
      weights: {
        mustHaveSkills: 0.5,
        niceToHaveSkills: 0.15,
        experience: 0.25,
        location: 0.1,
      },
      thresholds: {
        minMatchScore: 0.65,
        shortlistMinScore: 0.75,
        shortlistMaxCandidates: 3,
      },
    },
     shortlist: {
     strategy: "quality",
    },
    explain: {
      level: "detailed",
      includeWeights: true,
    },
    safety: {
      requireMustHaves: true,
      excludeInternalCandidates: true,
      confidenceBands: { high: 0.75, medium: 0.55 },
    },
  },
  balanced: {
    scoring: {
      strategy: "weighted",
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
     strategy: "quality",
    },
    explain: {
      level: "standard",
      includeWeights: true,
    },
    safety: {
      requireMustHaves: true,
      excludeInternalCandidates: false,
      confidenceBands: { high: 0.75, medium: 0.55 },
    },
  },
  aggressive: {
    scoring: {
      strategy: "weighted",
      weights: {
        mustHaveSkills: 0.3,
        niceToHaveSkills: 0.25,
        experience: 0.25,
        location: 0.2,
      },
      thresholds: {
        minMatchScore: 0.45,
        shortlistMinScore: 0.55,
        shortlistMaxCandidates: 10,
      },
    },
      shortlist: {
      strategy: "quality",
    },
    explain: {
      level: "compact",
      includeWeights: false,
    },
    safety: {
      requireMustHaves: false,
      excludeInternalCandidates: false,
      confidenceBands: { high: 0.75, medium: 0.55 },
    },
  },
};
