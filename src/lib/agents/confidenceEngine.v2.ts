export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export type ConfidenceSignals = {
  candidateId: string;
  must_have_coverage?: number | null;
  nice_to_have_coverage?: number | null;
  experience_alignment?: number | null;
  engagement_signal?: number | null;
  quality_signal?: number | null;
  duration?: number | null;
  language_analysis?: number | null;
};

export type ConfidenceConfig = {
  bands: { high: number; medium: number };
  signalWeights: {
    must_have_coverage: number;
    nice_to_have_coverage: number;
    experience_alignment: number;
    engagement_signal: number;
    quality_signal: number;
    duration: number;
    language_analysis: number;
  };
};

export type ConfidenceResult = {
  candidateId: string;
  band: ConfidenceBand;
  reasons: string[];
  score: number;
};

export type ConfidenceResultLog = ConfidenceResult & {
  reasonsString?: string;
  config?: ConfidenceConfig;
  debug?: {
    score: number;
    signalScores: Record<keyof ConfidenceSignals, number>;
  };
};

const signalLabels: Record<keyof ConfidenceSignals, string> = {
  candidateId: "Candidate",
  must_have_coverage: "Must-have coverage",
  nice_to_have_coverage: "Nice-to-have coverage",
  experience_alignment: "Experience alignment",
  engagement_signal: "Engagement signal",
  quality_signal: "Quality signal",
  duration: "Duration",
  language_analysis: "Language analysis",
};

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  bands: { high: 0.75, medium: 0.6 },
  signalWeights: {
    must_have_coverage: 1,
    nice_to_have_coverage: 1,
    experience_alignment: 1,
    engagement_signal: 1,
    quality_signal: 1,
    duration: 1,
    language_analysis: 1,
  },
};

const normalize = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;

  const normalized = value > 1 ? value / 100 : value;
  return Math.min(Math.max(normalized, 0), 1);
};

const formatPercent = (value: number | undefined | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  return `${Math.round(value * 100)}%`;
};

const collectNormalizedSignals = (
  signals: ConfidenceSignals,
): Record<keyof ConfidenceSignals, number> => {
  const normalized: Partial<Record<keyof ConfidenceSignals, number>> = {};

  (Object.keys(signalLabels) as Array<keyof ConfidenceSignals>).forEach((key) => {
    const value = normalize(signals[key]);
    if (value !== null) {
      normalized[key] = value;
    }
  });

  return normalized as Record<keyof ConfidenceSignals, number>;
};

export function getConfidenceScore(
  signals: ConfidenceSignals,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG,
): { score: number; signalScores: Record<keyof ConfidenceSignals, number> } {
  const normalizedSignals = collectNormalizedSignals(signals);
  const entries = Object.entries(normalizedSignals).filter(
    ([key]) => key !== "candidateId",
  ) as Array<[Exclude<keyof ConfidenceSignals, "candidateId">, number]>;

  let totalWeighted = 0;
  let totalWeight = 0;

  entries.forEach(([key, value]) => {
    const weight = config.signalWeights[key];

    if (weight > 0) {
      totalWeighted += value * weight;
      totalWeight += weight;
    }
  });

  const score = totalWeight === 0 ? 0 : totalWeighted / totalWeight;

  return { score, signalScores: normalizedSignals };
}

export function getConfidenceBand(
  score: number,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG,
): ConfidenceBand {
  const normalizedScore = score > 1 ? score / 100 : score;
  const { high, medium } = config.bands;

  if (normalizedScore >= high) return "HIGH";
  if (normalizedScore >= medium) return "MEDIUM";
  return "LOW";
}

const findSignal = (
  signalScores: Record<keyof ConfidenceSignals, number>,
  comparator: (a: number, b: number) => number,
): { key: keyof ConfidenceSignals; value: number } | null => {
  const usableEntries = Object.entries(signalScores).filter(
    ([key]) => key !== "candidateId",
  ) as Array<[keyof ConfidenceSignals, number]>;

  if (usableEntries.length === 0) return null;

  const sorted = usableEntries.sort(([, a], [, b]) => comparator(a, b));
  const [key, value] = sorted[0];
  return { key, value };
};

export function buildConfidenceSummary(
  score: number,
  signals?: ConfidenceSignals,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG,
): { band: ConfidenceBand; reasons: string[]; score: number } {
  const normalizedScore = score > 1 ? score / 100 : score;
  const evaluatedSignals = signals ? collectNormalizedSignals(signals) : {};
  const band = getConfidenceBand(normalizedScore, config);
  const reasons: string[] = [];

  if (band === "HIGH") {
    reasons.push(`Score ${formatPercent(normalizedScore) ?? normalizedScore} is in HIGH confidence band.`);
  } else if (band === "MEDIUM") {
    const weakest = findSignal(evaluatedSignals, (a, b) => a - b);
    if (weakest) {
      reasons.push(
        `${signalLabels[weakest.key]} is the weakest factor (${formatPercent(weakest.value) ?? weakest.value}).`,
      );
    }
    reasons.push(`Overall score ${formatPercent(normalizedScore) ?? normalizedScore} sits in MEDIUM confidence band.`);
  } else {
    const strongest = findSignal(evaluatedSignals, (a, b) => b - a);
    if (strongest) {
      reasons.push(
        `${signalLabels[strongest.key]} shows some strength (${formatPercent(strongest.value) ?? strongest.value}), but overall score ${formatPercent(normalizedScore) ?? normalizedScore} is LOW.`,
      );
    } else {
      reasons.push("Insufficient signal data; confidence is LOW by default.");
    }
  }

  return { band, reasons, score: normalizedScore };
}
