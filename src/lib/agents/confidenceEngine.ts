import { defaultTenantGuardrails } from "@/lib/guardrails/defaultTenantConfig";
import { loadTenantConfig as loadGuardrailsConfig } from "@/lib/guardrails/tenantConfig";
import type { GuardrailsConfig } from "@/lib/guardrails/presets";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export type ConfidenceRiskFlagType = "MISSING_DATA" | "STALE_ATS_SYNC" | "CONFLICTING_SIGNALS";

export type ConfidenceRiskFlag = { type: ConfidenceRiskFlagType; detail: string };

export type RecommendedRecruiterAction = "REQUEST_INFO" | "PUSH" | "REJECT" | "ESCALATE";

export type ConfidenceSignals = {
  mustHaveCoverage?: number;
  niceToHaveCoverage?: number;
  experienceAlignment?: number;
  engagement?: number;
  missingMustHaves?: string[];
  notes?: string[];
};

export type MatchResult = {
  candidateId: string;
  score: number;
  signals?: ConfidenceSignals;
};

type WeakSignal = { label: string; value: number } | null;

const DEFAULT_CONFIDENCE_BANDS = defaultTenantGuardrails.safety.confidenceBands;

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const normalizeScore = (score: number) => (score > 1 ? score / 100 : score);

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  return `${Math.round(value * 100)}%`;
}

function selectWeakestSignal(signals: Array<{ label: string; value?: number | null }>): WeakSignal {
  const filtered = signals.filter((signal) => typeof signal.value === "number") as Array<{
    label: string;
    value: number;
  }>;

  if (filtered.length === 0) return null;

  return filtered.sort((a, b) => a.value - b.value)[0];
}

export function getConfidenceBand(score: number, config: GuardrailsConfig): ConfidenceBand {
  const bands = (config.safety.confidenceBands as { high?: number; medium?: number } | undefined) ??
    DEFAULT_CONFIDENCE_BANDS;
  const high = bands?.high ?? DEFAULT_CONFIDENCE_BANDS.high;
  const medium = bands?.medium ?? DEFAULT_CONFIDENCE_BANDS.medium;
  const normalizedScore = normalizeScore(score);

  if (normalizedScore >= high) return "HIGH";
  if (normalizedScore >= medium) return "MEDIUM";
  return "LOW";
}

export function buildConfidenceSummary(
  match: MatchResult,
  config: GuardrailsConfig = defaultTenantGuardrails,
  confidenceScore?: number,
): { band: ConfidenceBand; reasons: string[] } {
  const normalizedScore = confidenceScore != null ? confidenceScore / 100 : normalizeScore(match.score);
  const band = getConfidenceBand(normalizedScore, config);
  const signals = match.signals ?? {};
  const reasons: string[] = [];

  const mustHaveCoverage = signals.mustHaveCoverage;
  const niceToHaveCoverage = signals.niceToHaveCoverage;
  const experienceAlignment = signals.experienceAlignment;
  const engagement = signals.engagement;
  const missingMustHaves = signals.missingMustHaves ?? [];

  const formattedScore = formatPercent(normalizedScore);
  if (formattedScore) {
    reasons.push(`Score ${formattedScore} maps to ${band} confidence.`);
  }

  const weakestSignal = selectWeakestSignal([
    { label: "must-have skills", value: mustHaveCoverage },
    { label: "experience alignment", value: experienceAlignment },
    { label: "engagement", value: engagement },
    { label: "nice-to-have coverage", value: niceToHaveCoverage },
  ]);

  if (band === "HIGH") {
    reasons.push(
      mustHaveCoverage !== undefined
        ? `Strong must-have coverage (${formatPercent(mustHaveCoverage) ?? "robust"}).`
        : "Strong coverage of must-have requirements.",
    );
    reasons.push(
      experienceAlignment !== undefined
        ? `Experience aligns with the role (${formatPercent(experienceAlignment) ?? "solid"}).`
        : "Experience alignment supports confidence.",
    );
    if (engagement !== undefined) {
      reasons.push(`Engagement signals look healthy (${formatPercent(engagement) ?? "solid"}).`);
    }
    if (niceToHaveCoverage !== undefined) {
      reasons.push(
        `Nice-to-have skills also contribute (${formatPercent(niceToHaveCoverage) ?? "strong"}).`,
      );
    }
  } else if (band === "MEDIUM") {
    if (weakestSignal) {
      reasons.push(
        `Good overall fit, but ${weakestSignal.label} is weaker at ${formatPercent(weakestSignal.value) ?? "lower"}.`,
      );
    } else {
      reasons.push("Decent fit with at least one area needing verification.");
    }

    if (missingMustHaves.length > 0) {
      reasons.push(`Missing must-have skills to validate: ${missingMustHaves.join(", ")}.`);
    }
  } else {
    if (missingMustHaves.length > 0) {
      reasons.push(`Missing must-have skills: ${missingMustHaves.join(", ")}.`);
    } else if (mustHaveCoverage !== undefined) {
      reasons.push(`Must-have coverage is low at ${formatPercent(mustHaveCoverage) ?? "a limited level"}.`);
    } else {
      reasons.push("Insufficient evidence about must-have skills.");
    }

    if (experienceAlignment !== undefined) {
      reasons.push(
        `Experience alignment appears weak (${formatPercent(experienceAlignment) ?? "low"}); further review is needed.`,
      );
    }
  }

  if (signals.notes?.length) {
    reasons.push(...signals.notes);
  }

  if (reasons.length === 0) {
    reasons.push(`Confidence band ${band} derived from available match signals.`);
  }

  return { band, reasons };
}

function computeConfidenceScore(match: MatchResult): number {
  const baseScore = normalizeScore(match.score) * 100;
  const signals = match.signals ?? {};

  const hasAnySignalData = Boolean(
    signals.notes?.length ||
      signals.mustHaveCoverage !== undefined ||
      signals.experienceAlignment !== undefined ||
      signals.engagement !== undefined ||
      signals.niceToHaveCoverage !== undefined ||
      (signals.missingMustHaves?.length ?? 0) > 0,
  );

  const missingMustHavePenalty = (signals.missingMustHaves?.length ?? 0) * 5;
  const missingSignalPenalty = hasAnySignalData
    ?
        Math.max(
          0,
          [signals.mustHaveCoverage, signals.experienceAlignment, signals.engagement, signals.niceToHaveCoverage].filter(
            (value) => value == null,
          ).length - 1,
        ) * 2
    : 0;

  const staleDataPenalty = (signals.notes ?? []).some((note) => /stale|sync/i.test(note)) ? 7 : 0;

  const conflictingSignalPenalty = (() => {
    const { mustHaveCoverage, experienceAlignment } = signals;
    if (
      typeof mustHaveCoverage === "number" &&
      typeof experienceAlignment === "number" &&
      Math.abs(mustHaveCoverage - experienceAlignment) >= 0.35
    ) {
      return 8;
    }
    return 0;
  })();

  const penalties = missingMustHavePenalty + missingSignalPenalty + staleDataPenalty + conflictingSignalPenalty;

  return clampScore(baseScore - penalties);
}

function identifyRiskFlags(match: MatchResult): ConfidenceRiskFlag[] {
  const signals = match.signals ?? {};
  const flags: ConfidenceRiskFlag[] = [];

  const missingSignals = [signals.mustHaveCoverage, signals.experienceAlignment, signals.engagement].filter(
    (value) => value == null,
  ).length;

  if ((signals.missingMustHaves?.length ?? 0) > 0 || missingSignals >= 4) {
    const missingList = signals.missingMustHaves?.length ? `Missing must-haves: ${signals.missingMustHaves.join(", ")}.` :
      "Limited evidence across core signals.";
    flags.push({ type: "MISSING_DATA", detail: missingList });
  }

  const staleNote = (signals.notes ?? []).find((note) => /stale|sync/i.test(note));
  if (staleNote) {
    flags.push({ type: "STALE_ATS_SYNC", detail: `Data freshness risk: ${staleNote}` });
  }

  const { mustHaveCoverage, experienceAlignment } = signals;
  if (
    typeof mustHaveCoverage === "number" &&
    typeof experienceAlignment === "number" &&
    Math.abs(mustHaveCoverage - experienceAlignment) >= 0.35
  ) {
    flags.push({
      type: "CONFLICTING_SIGNALS",
      detail: `Must-have coverage ${formatPercent(mustHaveCoverage) ?? ""} conflicts with experience alignment ${
        formatPercent(experienceAlignment) ?? ""
      }.`,
    });
  }

  return flags;
}

function recommendRecruiterAction(
  band: ConfidenceBand,
  confidenceScore: number,
  riskFlags: ConfidenceRiskFlag[],
): RecommendedRecruiterAction {
  if (band === "LOW" || confidenceScore < 50) {
    return riskFlags.some((flag) => flag.type === "CONFLICTING_SIGNALS") ? "ESCALATE" : "REJECT";
  }

  if (riskFlags.some((flag) => flag.type === "CONFLICTING_SIGNALS")) {
    return "ESCALATE";
  }

  if (riskFlags.some((flag) => flag.type === "MISSING_DATA" || flag.type === "STALE_ATS_SYNC")) {
    return "REQUEST_INFO";
  }

  return "PUSH";
}

export type ConfidenceAgentInput = {
  matchResults: MatchResult[];
  job: { id: string };
  tenantId?: string | null;
};

type ConfidenceAgentDeps = {
  loadGuardrails?: typeof loadGuardrailsConfig;
  loadMode?: typeof loadTenantMode;
};

export async function runConfidenceAgent(
  { matchResults, job, tenantId }: ConfidenceAgentInput,
  deps: ConfidenceAgentDeps = {},
) {
  const loadGuardrails = deps.loadGuardrails ?? loadGuardrailsConfig;
  const loadMode = deps.loadMode ?? loadTenantMode;

  const [guardrails, mode] = await Promise.all([
    loadGuardrails(tenantId ?? undefined),
    loadMode(tenantId ?? "default-tenant"),
  ]);

  const confidenceEnabled = mode.agentsEnabled.includes("CONFIDENCE");

  const results = matchResults.map((match) => {
    const confidenceScore = computeConfidenceScore(match);
    const summary = confidenceEnabled
      ? buildConfidenceSummary(match, guardrails, confidenceScore)
      : {
          band: getConfidenceBand(confidenceScore / 100, guardrails),
          reasons: [] as string[],
        };

    const riskFlags = confidenceEnabled ? identifyRiskFlags(match) : [];
    const recommendedAction = recommendRecruiterAction(summary.band, confidenceScore, riskFlags);

    return {
      candidateId: match.candidateId,
      score: normalizeScore(match.score),
      confidenceScore,
      confidenceBand: summary.band,
      confidenceReasons: confidenceEnabled ? summary.reasons : [],
      riskFlags,
      recommendedAction,
    };
  });

  return { jobId: job.id, results } satisfies {
    jobId: string;
    results: Array<{
      candidateId: string;
      score: number;
      confidenceScore: number;
      confidenceBand: ConfidenceBand;
      confidenceReasons: string[];
      riskFlags: ConfidenceRiskFlag[];
      recommendedAction: RecommendedRecruiterAction;
    }>;
  };
}
