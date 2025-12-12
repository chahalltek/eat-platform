import { guardrailsPresets, type GuardrailsConfig, type ShortlistStrategy } from "@/lib/guardrails/presets";
import type { ConfidenceBand } from "./confidenceEngine";
import type { MatchResult } from "./matchEngine";

export type { ShortlistStrategy };

type ShortlistMatch = {
  candidateId: string;
  score: number;
  confidenceBand: ConfidenceBand;
  signals: MatchResult["signals"];
};

const CONFIDENCE_ORDER: Record<ConfidenceBand, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function normalizeThreshold(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;

  return value <= 1 ? value * 100 : value;
}

function resolveThresholds(config: GuardrailsConfig) {
  const thresholds = (config.scoring as { thresholds?: { minMatchScore?: number; shortlistMinScore?: number } } | undefined)
    ?.thresholds;
  const presetThresholds = guardrailsPresets.balanced.scoring.thresholds as { minMatchScore?: number; shortlistMinScore?: number };

  return {
    minMatchScore: normalizeThreshold(thresholds?.minMatchScore, normalizeThreshold(presetThresholds.minMatchScore, 0)),
    shortlistMinScore: normalizeThreshold(
      thresholds?.shortlistMinScore,
      normalizeThreshold(presetThresholds.shortlistMinScore, normalizeThreshold(thresholds?.minMatchScore, 0)),
    ),
  };
}

function resolveMaxCandidates(config: GuardrailsConfig) {
  const shortlist = (config.shortlist as { maxCandidates?: number } | undefined) ?? {};
  const thresholds = (config.scoring as { thresholds?: { shortlistMaxCandidates?: number } } | undefined)?.thresholds ?? {};
  const presetThresholds = guardrailsPresets.balanced.scoring.thresholds as { shortlistMaxCandidates?: number };

  return (
    shortlist.maxCandidates ??
    thresholds.shortlistMaxCandidates ??
    presetThresholds.shortlistMaxCandidates ??
    Number.POSITIVE_INFINITY
  );
}

function baseFilter(match: ShortlistMatch, minScore: number) {
  return match.score >= minScore;
}

function strictFilter(match: ShortlistMatch, minScore: number, minMatchScore: number) {
  return match.confidenceBand === "HIGH" && match.score >= minScore && match.score >= minMatchScore;
}

function sortByQuality(a: ShortlistMatch, b: ShortlistMatch) {
  if (b.score !== a.score) return b.score - a.score;

  return CONFIDENCE_ORDER[b.confidenceBand] - CONFIDENCE_ORDER[a.confidenceBand];
}

function sortByScore(a: ShortlistMatch, b: ShortlistMatch) {
  return b.score - a.score;
}

function areSignalsSimilar(
  aSignals: MatchResult["signals"],
  bSignals: MatchResult["signals"],
  tolerance = 0.05,
) {
  const keys = new Set([...Object.keys(aSignals ?? {}), ...Object.keys(bSignals ?? {})]);

  for (const key of keys) {
    const aValue = (aSignals as Record<string, number | undefined>)[key] ?? 0;
    const bValue = (bSignals as Record<string, number | undefined>)[key] ?? 0;

    if (Math.abs(aValue - bValue) > tolerance) {
      return false;
    }
  }

  return true;
}

export function buildShortlist(input: {
  matches: ShortlistMatch[];
  config: GuardrailsConfig;
  strategy?: ShortlistStrategy;
}): string[] {
  const thresholds = resolveThresholds(input.config);
  const maxCandidates = resolveMaxCandidates(input.config);
  const strategy = input.strategy ?? ((input.config.shortlist as { strategy?: ShortlistStrategy } | undefined)?.strategy ?? "quality");

  const minScore = Math.max(thresholds.minMatchScore, thresholds.shortlistMinScore);

  const eligible = input.matches.filter((match) => baseFilter(match, minScore));

  if (eligible.length === 0 || maxCandidates <= 0) {
    return [];
  }

  const sortedForDiversity = [...eligible].sort(sortByQuality);

  if (strategy === "strict") {
    return eligible
      .filter((match) => strictFilter(match, thresholds.shortlistMinScore, thresholds.minMatchScore))
      .sort(sortByQuality)
      .slice(0, maxCandidates)
      .map((match) => match.candidateId);
  }

  if (strategy === "fast") {
    return eligible.sort(sortByScore).slice(0, maxCandidates).map((match) => match.candidateId);
  }

  if (strategy === "diversity") {
    const epsilon = 1;
    const selected: ShortlistMatch[] = [];

    for (const match of sortedForDiversity) {
      if (selected.length >= maxCandidates) break;

      const isDuplicate = selected.some(
        (existing) => Math.abs(existing.score - match.score) < epsilon && areSignalsSimilar(existing.signals, match.signals),
      );

      if (!isDuplicate) {
        selected.push(match);
      }
    }

    return selected.map((match) => match.candidateId);
  }

  return eligible.sort(sortByQuality).slice(0, maxCandidates).map((match) => match.candidateId);
}
