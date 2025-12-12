import { defaultTenantGuardrails } from "@/lib/guardrails/defaultTenantConfig";
import { loadTenantConfig as loadGuardrailsConfig } from "@/lib/guardrails/tenantConfig";
import type { GuardrailsConfig } from "@/lib/guardrails/presets";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

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
): { band: ConfidenceBand; reasons: string[] } {
  const normalizedScore = normalizeScore(match.score);
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
    loadGuardrails(tenantId),
    loadMode(tenantId ?? "default-tenant"),
  ]);

  const confidenceEnabled = mode.agentsEnabled.includes("CONFIDENCE");

  const results = matchResults.map((match) => {
    const summary = confidenceEnabled
      ? buildConfidenceSummary(match, guardrails)
      : {
          band: getConfidenceBand(match.score, guardrails),
          reasons: [] as string[],
        };

    return {
      candidateId: match.candidateId,
      score: normalizeScore(match.score),
      confidenceBand: summary.band,
      confidenceReasons: confidenceEnabled ? summary.reasons : [],
    };
  });

  return { jobId: job.id, results } satisfies {
    jobId: string;
    results: Array<{
      candidateId: string;
      score: number;
      confidenceBand: ConfidenceBand;
      confidenceReasons: string[];
    }>;
  };
}
