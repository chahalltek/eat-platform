import type { ConfidenceResult } from "./confidenceEngine.v2";
import type { Explanation } from "./explainEngine";
import type { Candidate, Job, MatchResult } from "./matchEngine";

export type JustificationInput = {
  job: Job;
  candidate: Candidate;
  match: MatchResult;
  confidence?: ConfidenceResult;
  explanation?: Explanation;
};

export type JustificationOutput = {
  subject: string;
  body: string;
};

const DEFAULT_SIGNAL = 0.5;

function normalizePercent(value?: number | null, fallback = 0): number {
  if (typeof value !== "number" || Number.isNaN(value)) return Math.round(fallback * 100);
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.round(normalized));
}

function resolveCandidateName(candidate: Candidate): string {
  const enriched = candidate as Candidate & {
    name?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };

  const name =
    enriched.name ??
    enriched.fullName ??
    [enriched.firstName, enriched.lastName].filter(Boolean).join(" ") ??
    "";

  return name.trim() || candidate.id;
}

function resolveJobTitle(job: Job): string {
  const enriched = job as Job & { title?: string | null; role?: string | null; name?: string | null };
  const title = enriched.title ?? enriched.role ?? enriched.name ?? "";
  return title.trim() || job.id;
}

function formatSignal(value?: number | null): string {
  return `${normalizePercent(value, DEFAULT_SIGNAL)}%`;
}

function generateStrengths(input: JustificationInput): string[] {
  const baseStrengths = [...(input.explanation?.strengths ?? [])].filter(Boolean);
  const signals = input.match.signals ?? {};

  const derived = [
    `Must-have skill coverage at ${formatSignal(signals.mustHaveSkillsCoverage)}.`,
    `Experience alignment near ${formatSignal(signals.experienceAlignment)}.`,
    `Overall match score of ${normalizePercent(input.match.score)}% suggests solid fit.`,
  ];

  const combined = [...baseStrengths, ...derived];

  while (combined.length < 3) {
    combined.push("Consistent signals indicate readiness for the role.");
  }

  return combined.slice(0, 3);
}

function generateRisks(input: JustificationInput): string[] {
  const baseRisks = [...(input.explanation?.risks ?? [])].filter(Boolean);
  const signals = input.match.signals ?? {};
  const risks = [...baseRisks];

  const mustHaveCoverage = signals.mustHaveSkillsCoverage ?? DEFAULT_SIGNAL;
  const experienceAlignment = signals.experienceAlignment ?? DEFAULT_SIGNAL;
  const locationAlignment = signals.locationAlignment ?? DEFAULT_SIGNAL;

  if (mustHaveCoverage < 0.8) {
    risks.push("Some must-have skills may require ramp-up.");
  }

  if (experienceAlignment < 0.6) {
    risks.push("Experience may sit below the target range.");
  }

  if (locationAlignment < 0.5) {
    risks.push("Location/availability may need clarification.");
  }

  if (input.confidence?.band === "LOW") {
    risks.push("Low confidence band; validate profile details manually.");
  }

  if (risks.length === 0) {
    risks.push("No critical risks identified; confirm details during conversation.");
  }

  return risks.slice(0, 2);
}

function buildSummary(
  candidateName: string,
  jobTitle: string,
  strengths: string[],
  risks: string[],
  explanation?: Explanation,
  match?: MatchResult,
): string {
  if (explanation?.summary) return explanation.summary.trim();

  const scoreText = match ? `${normalizePercent(match.score)}%` : "solid";
  const leadingStrength = strengths[0] ?? "relevant alignment";
  const leadingRisk = risks[0];

  if (leadingRisk) {
    return `${candidateName} shows a ${scoreText} match for ${jobTitle}, with ${leadingStrength} and a key risk around ${leadingRisk}`;
  }

  return `${candidateName} shows a ${scoreText} match for ${jobTitle}, highlighted by ${leadingStrength}`;
}

function buildConfidenceLine(confidence?: ConfidenceResult): string | null {
  if (!confidence) return null;
  const scoreText = `${normalizePercent(confidence.score)}%`;
  const reason = confidence.reasons?.[0];
  const reasonText = reason ? ` – ${reason}` : "";
  return `Confidence: ${confidence.band} (${scoreText})${reasonText}`;
}

function buildNextStep(risks: string[], strengths: string[]): string {
  const focusRisk = risks[0] ?? "role expectations";
  const highlight = strengths[0]?.toLowerCase() ?? "core strengths";
  return `Schedule a structured screen focusing on ${focusRisk}; validate ${highlight} in depth.`;
}

export function buildJustification(input: JustificationInput): JustificationOutput {
  const candidateName = resolveCandidateName(input.candidate);
  const jobTitle = resolveJobTitle(input.job);

  const strengths = generateStrengths(input);
  const risks = generateRisks(input);
  const summary = buildSummary(candidateName, jobTitle, strengths, risks, input.explanation, input.match);
  const confidenceLine = buildConfidenceLine(input.confidence);
  const nextStep = buildNextStep(risks, strengths);

  const lines = [summary];

  if (confidenceLine) {
    lines.push("", confidenceLine);
  }

  lines.push("", "Top strengths:");
  strengths.forEach((strength) => lines.push(`- ${strength}`));

  lines.push("", "Risks:");
  risks.forEach((risk) => lines.push(`- ${risk}`));

  lines.push("", "Next best step:", `- ${nextStep}`);

  return {
    subject: `Recommendation: ${candidateName} for ${jobTitle}`,
    body: lines.join("\n"),
  } satisfies JustificationOutput;
}

export default buildJustification;
