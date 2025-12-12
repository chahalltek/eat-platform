import type { GuardrailsConfig } from "@/lib/guardrails/presets";
import type { ConfidenceResult } from "./confidenceEngine.v2";
import type { Candidate, Job, MatchResult } from "./matchEngine";

export type Explanation = {
  summary: string;
  strengths: string[];
  risks: string[];
};

export type ExplainInput = {
  job: Job;
  candidate: Candidate;
  match: MatchResult;
  confidence: ConfidenceResult;
  config: GuardrailsConfig;
};

type Verbosity = "compact" | "detailed";

const DEFAULT_EXPERIENCE_ALIGNMENT = 0.5;
const DEFAULT_LOCATION_ALIGNMENT = 0.5;
const DEFAULT_MUST_HAVE_COVERAGE = 0.5;

function resolveVerbosity(config: GuardrailsConfig): Verbosity {
  const level = (config.explain as { level?: string } | undefined)?.level;
  return level === "compact" ? "compact" : "detailed";
}

function buildStrengths(input: ExplainInput, verbosity: Verbosity): string[] {
  const strengths: string[] = [];
  const { match, confidence } = input;

  const mustHaveCoverage = match.signals?.mustHaveSkillsCoverage ?? DEFAULT_MUST_HAVE_COVERAGE;
  const experienceAlignment = match.signals?.experienceAlignment ?? DEFAULT_EXPERIENCE_ALIGNMENT;

  if (mustHaveCoverage >= 0.8) {
    strengths.push(`High must-have skill coverage (${Math.round(mustHaveCoverage * 100)}%).`);
  }

  if (experienceAlignment >= 0.7) {
    strengths.push("Strong experience alignment with the role expectations.");
  }

  if (confidence.band === "HIGH") {
    const reason = confidence.reasons?.[0];
    strengths.push(reason ? `High confidence band driven by ${reason}.` : "High confidence band supported by reliable signals.");
  }

  const max = verbosity === "compact" ? 2 : 5;
  const min = verbosity === "compact" ? 1 : 3;
  const trimmed = strengths.slice(0, max);

  while (trimmed.length < min) {
    trimmed.push("Overall signals suggest strong fit.");
  }

  return trimmed;
}

function isLocationMismatch(job: Job, candidate: Candidate, alignment: number): boolean {
  const normalizedJob = job.location?.trim().toLowerCase();
  const normalizedCandidate = candidate.location?.trim().toLowerCase();

  if (!normalizedJob || !normalizedCandidate) return alignment < 0.5;

  return normalizedJob !== normalizedCandidate || alignment < 0.5;
}

function buildRisks(input: ExplainInput, verbosity: Verbosity): string[] {
  const risks: string[] = [];
  const { job, candidate, match, confidence } = input;

  const mustHaveCoverage = match.signals?.mustHaveSkillsCoverage ?? DEFAULT_MUST_HAVE_COVERAGE;
  const experienceAlignment = match.signals?.experienceAlignment ?? DEFAULT_EXPERIENCE_ALIGNMENT;
  const locationAlignment = match.signals?.locationAlignment ?? DEFAULT_LOCATION_ALIGNMENT;

  if (mustHaveCoverage < 0.8) {
    risks.push("Missing must-have skills may require ramp-up.");
  }

  const targetMinYears = job.minExperienceYears ?? null;
  const candidateYears = candidate.totalExperienceYears ?? null;
  if ((typeof targetMinYears === "number" && typeof candidateYears === "number" && candidateYears < targetMinYears) || experienceAlignment < 0.5) {
    risks.push("Experience appears below the target range.");
  }

  if (isLocationMismatch(job, candidate, locationAlignment)) {
    risks.push("Location mismatch could impact availability expectations.");
  }

  if (confidence.band === "LOW") {
    risks.push("Low confidence band; profile data needs manual validation.");
  }

  const max = verbosity === "compact" ? 1 : 3;
  const min = verbosity === "compact" ? 0 : 1;
  const trimmed = risks.slice(0, max);

  while (trimmed.length < min) {
    trimmed.push("No significant risks flagged.");
  }

  return trimmed;
}

function buildSummary(strengths: string[], risks: string[]): string {
  const leadingStrength = strengths[0] ?? "Candidate shows relevant alignment.";
  const leadingRisk = risks[0];

  return leadingRisk ? `${leadingStrength} Top risk: ${leadingRisk}` : leadingStrength;
}

export function buildExplanation(input: ExplainInput): Explanation {
  const verbosity = resolveVerbosity(input.config);
  const strengths = buildStrengths(input, verbosity);
  const risks = buildRisks(input, verbosity);

  return {
    summary: buildSummary(strengths, risks),
    strengths,
    risks,
  };
}
