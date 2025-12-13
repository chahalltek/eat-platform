import type { GuardrailsConfig } from "@/lib/guardrails/presets";
import type { MatchSignals } from "./matchEngine";

export type ShortlistStrategy = "quality" | "strict" | "fast" | "diversity";

export type ShortlistInput = {
  matches: Array<{
    candidateId: string;
    score: number;
    confidenceBand?: "HIGH" | "MEDIUM" | "LOW";
    signals?: MatchSignals;
  }>;
  config: GuardrailsConfig;
  strategy?: ShortlistStrategy;
};

export type ShortlistOutput = {
  shortlistedCandidateIds: string[];
  cutoffScore?: number;
  notes?: string[];
};

type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

type NormalizedMatch = {
  candidateId: string;
  score: number;
  confidenceBand: ConfidenceBand;
  signals?: MatchSignals;
};

const CONFIDENCE_PRIORITY: Record<ConfidenceBand, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const SCORE_SIMILARITY_EPSILON = 0.5;
const SIGNAL_SIMILARITY_TOLERANCE = 0.05;

function resolveStrategy(input: ShortlistInput): ShortlistStrategy {
  return (
    input.strategy ??
    ((input.config.shortlist as { strategy?: ShortlistStrategy } | undefined)?.strategy ?? "quality")
  );
}

function resolveMaxCandidates(config: GuardrailsConfig): number {
  const shortlistMax = (config.shortlist as { maxCandidates?: number } | undefined)?.maxCandidates;
  const thresholdsMax =
    (config.scoring as { thresholds?: { shortlistMaxCandidates?: number } } | undefined)?.thresholds
      ?.shortlistMaxCandidates;

  const numeric = shortlistMax ?? thresholdsMax;
  if (typeof numeric === "number" && numeric > 0) {
    return Math.floor(numeric);
  }

  return Number.POSITIVE_INFINITY;
}

function normalizeConfidenceBand(band?: ConfidenceBand): ConfidenceBand {
  return band ?? "LOW";
}

function toNormalizedMatches(matches: ShortlistInput["matches"]): NormalizedMatch[] {
  return matches.map((match) => ({
    candidateId: match.candidateId,
    score: match.score,
    confidenceBand: normalizeConfidenceBand(match.confidenceBand),
    signals: match.signals,
  }));
}

function compareQuality(a: NormalizedMatch, b: NormalizedMatch): number {
  const scoreDiff = b.score - a.score;
  if (Math.abs(scoreDiff) > SCORE_SIMILARITY_EPSILON) return scoreDiff;

  const confidenceDiff = CONFIDENCE_PRIORITY[b.confidenceBand] - CONFIDENCE_PRIORITY[a.confidenceBand];
  if (confidenceDiff !== 0) return confidenceDiff;

  return a.candidateId.localeCompare(b.candidateId);
}

function compareScoreOnly(a: NormalizedMatch, b: NormalizedMatch): number {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;

  return a.candidateId.localeCompare(b.candidateId);
}

function resolveShortlistMinScore(config: GuardrailsConfig): number {
  const minScore =
    (config.scoring as { thresholds?: { shortlistMinScore?: number } } | undefined)?.thresholds
      ?.shortlistMinScore ?? -Infinity;

  return typeof minScore === "number" && !Number.isNaN(minScore) ? minScore : -Infinity;
}

function signalsAreSimilar(a?: MatchSignals, b?: MatchSignals, tolerance = SIGNAL_SIMILARITY_TOLERANCE): boolean {
  if (!a || !b) return false;

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of keys) {
    const aValue = (a as Record<string, number | undefined>)[key] ?? 0;
    const bValue = (b as Record<string, number | undefined>)[key] ?? 0;

    if (Math.abs(aValue - bValue) > tolerance) {
      return false;
    }
  }

  return true;
}

function buildQualityShortlist(matches: NormalizedMatch[], maxCandidates: number): ShortlistOutput {
  const ordered = [...matches].sort(compareQuality).slice(0, maxCandidates);
  return {
    shortlistedCandidateIds: ordered.map((match) => match.candidateId),
    cutoffScore: ordered.at(-1)?.score,
    notes: ["strategy=quality"],
  };
}

function buildStrictShortlist(matches: NormalizedMatch[], minScore: number, maxCandidates: number): ShortlistOutput {
  const filtered = matches
    .filter((match) => match.confidenceBand === "HIGH" && match.score >= minScore)
    .sort(compareQuality)
    .slice(0, maxCandidates);

  return {
    shortlistedCandidateIds: filtered.map((match) => match.candidateId),
    cutoffScore: filtered.at(-1)?.score,
    notes: ["strategy=strict", `minScore=${Number.isFinite(minScore) ? minScore : "none"}`],
  };
}

function buildFastShortlist(matches: NormalizedMatch[], maxCandidates: number): ShortlistOutput {
  const ordered = [...matches].sort(compareScoreOnly).slice(0, maxCandidates);
  return {
    shortlistedCandidateIds: ordered.map((match) => match.candidateId),
    cutoffScore: ordered.at(-1)?.score,
    notes: ["strategy=fast"],
  };
}

function buildDiversityShortlist(matches: NormalizedMatch[], maxCandidates: number): ShortlistOutput {
  const ordered = [...matches].sort(compareQuality);
  const selected: NormalizedMatch[] = [];

  for (const match of ordered) {
    if (selected.length >= maxCandidates) break;

    if (selected.length === 0) {
      selected.push(match);
      continue;
    }

    const hasSimilarSignals = selected.some((existing) => signalsAreSimilar(existing.signals, match.signals));

    if (hasSimilarSignals) continue;

    const lastSelected = selected[selected.length - 1];
    const isTooCloseInScore =
      lastSelected.confidenceBand === match.confidenceBand &&
      Math.abs(lastSelected.score - match.score) < SCORE_SIMILARITY_EPSILON;

    if (isTooCloseInScore) continue;

    selected.push(match);
  }

  const trimmed = selected.slice(0, maxCandidates);

  return {
    shortlistedCandidateIds: trimmed.map((match) => match.candidateId),
    cutoffScore: trimmed.at(-1)?.score,
    notes: ["strategy=diversity"],
  };
}

export function buildShortlist(input: ShortlistInput): ShortlistOutput {
  const strategy = resolveStrategy(input);
  const maxCandidates = resolveMaxCandidates(input.config);
  const normalizedMatches = toNormalizedMatches(input.matches);

  if (maxCandidates <= 0 || normalizedMatches.length === 0) {
    return { shortlistedCandidateIds: [] };
  }

  if (strategy === "strict") {
    return buildStrictShortlist(normalizedMatches, resolveShortlistMinScore(input.config), maxCandidates);
  }

  if (strategy === "fast") {
    return buildFastShortlist(normalizedMatches, maxCandidates);
  }

  if (strategy === "diversity") {
    return buildDiversityShortlist(normalizedMatches, maxCandidates);
  }

  return buildQualityShortlist(normalizedMatches, maxCandidates);
}
