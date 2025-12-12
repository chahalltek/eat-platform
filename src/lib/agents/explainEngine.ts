import { type GuardrailsConfig } from "@/lib/guardrails/presets";
import type { Candidate, Job, MatchResult } from "./matchEngine";

export type ConfidenceBand = {
  score: number;
  category: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
};

export type Explanation = {
  summary: string;
  strengths: string[];
  risks: string[];
  notes?: string[];
};

const DEFAULT_SIGNALS: MatchResult["signals"] = {
  mustHaveSkillsCoverage: 0.5,
  niceToHaveSkillsCoverage: 0.5,
  experienceAlignment: 0.5,
  locationAlignment: 0.5,
};

function toPercent(value: number) {
  return Math.round(value * 100);
}

function intersectSkills(jobSkills: Job["skills"], candidateSkills: Candidate["skills"], required: boolean) {
  const targetSkills = jobSkills.filter((skill) => Boolean(skill.required) === required);
  const candidateNames = new Set(
    candidateSkills.map((skill) => (skill.normalizedName ?? skill.name).trim().toLowerCase()),
  );

  const matches = targetSkills
    .map((skill) => skill.name)
    .filter((skill) => candidateNames.has(skill.trim().toLowerCase()));

  return matches;
}

function createStrengths(
  job: Job,
  candidate: Candidate,
  match: MatchResult,
  confidenceBand: ConfidenceBand,
  level: "compact" | "detailed",
): string[] {
  const signals = match.signals ?? DEFAULT_SIGNALS;
  const strengths: string[] = [];
  const mustHaveHits = intersectSkills(job.skills, candidate.skills, true);
  const niceToHaveHits = intersectSkills(job.skills, candidate.skills, false);

  if (signals.mustHaveSkillsCoverage >= 0.75) {
    const skillList = mustHaveHits.slice(0, 4).join(", ");
    strengths.push(
      skillList
        ? `Strong coverage of must-have skills (${skillList}).`
        : "Strong coverage of must-have skills.",
    );
  }

  if (signals.niceToHaveSkillsCoverage >= 0.6 && niceToHaveHits.length > 0) {
    strengths.push(`Good alignment on nice-to-have skills (${niceToHaveHits.slice(0, 4).join(", ")}).`);
  }

  if (signals.experienceAlignment >= 0.7) {
    strengths.push("Experience aligned with target expectations.");
  }

  if (signals.locationAlignment >= 0.7) {
    strengths.push("Location aligns with job preferences or remote flexibility.");
  }

  if (match.score >= 85) {
    strengths.push(`High overall match score (${match.score}).`);
  }

  if (confidenceBand.category === "HIGH") {
    strengths.push("Profile data quality supports high confidence.");
  }

  const maxStrengths = level === "compact" ? 2 : 5;
  const minStrengths = level === "compact" ? 1 : 3;
  const trimmed = strengths.slice(0, maxStrengths);

  while (trimmed.length < minStrengths) {
    trimmed.push("Solid alignment observed across multiple signals.");
  }

  return trimmed;
}

function createRisks(match: MatchResult, confidenceBand: ConfidenceBand, level: "compact" | "detailed") {
  const signals = match.signals ?? DEFAULT_SIGNALS;
  const risks: string[] = [];

  if (signals.mustHaveSkillsCoverage < 0.6) {
    risks.push("Limited coverage of must-have skills; confirm ability to ramp quickly.");
  }

  if (signals.experienceAlignment < 0.6) {
    risks.push("Experience slightly below target range for years in role.");
  }

  if (signals.locationAlignment < 0.5) {
    risks.push("Location does not fully match preferred region; confirm remote flexibility.");
  }

  if (confidenceBand.category === "LOW") {
    risks.push("Low confidence due to sparse profile data; validate details manually.");
  }

  const maxRisks = level === "compact" ? 1 : 3;
  const minRisks = level === "compact" ? 0 : 1;
  const trimmed = risks.slice(0, maxRisks);

  while (trimmed.length < minRisks) {
    trimmed.push("No major risks identified; proceed with standard diligence.");
  }

  return trimmed;
}

function buildNotes(match: MatchResult, confidenceBand: ConfidenceBand, includeWeights: boolean): string[] {
  const notes: string[] = [];
  const signals = match.signals ?? DEFAULT_SIGNALS;

  if (includeWeights) {
    notes.push(
      `Signal blend — must-have ${toPercent(signals.mustHaveSkillsCoverage)}%, nice-to-have ${toPercent(
        signals.niceToHaveSkillsCoverage,
      )}%, experience ${toPercent(signals.experienceAlignment)}%, location ${toPercent(signals.locationAlignment)}%.`,
    );
  }

  if (confidenceBand.reasons.length > 0) {
    notes.push(`Confidence rationale: ${confidenceBand.reasons[0]}`);
  }

  return notes;
}

function buildSummary(strengths: string[], risks: string[]) {
  const headlineStrength = strengths[0];
  const headlineRisk = risks[0];

  if (headlineRisk) {
    return `${headlineStrength} Key risk: ${headlineRisk}`;
  }

  return headlineStrength;
}

export function buildExplanation(input: {
  job: Job;
  candidate: Candidate;
  match: MatchResult;
  confidenceBand: ConfidenceBand;
  config: GuardrailsConfig;
}): Explanation {
  const level = (input.config.explain as { level?: string } | undefined)?.level === "compact" ? "compact" : "detailed";
  const includeWeights = Boolean((input.config.explain as { includeWeights?: boolean } | undefined)?.includeWeights);

  const strengths = createStrengths(
    input.job,
    input.candidate,
    { ...input.match, signals: input.match.signals ?? DEFAULT_SIGNALS },
    input.confidenceBand,
    level,
  );
  const risks = createRisks({ ...input.match, signals: input.match.signals ?? DEFAULT_SIGNALS }, input.confidenceBand, level);
  const notes = buildNotes(input.match, input.confidenceBand, includeWeights);

  return {
    summary: buildSummary(strengths, risks),
    strengths,
    risks,
    notes: notes.length > 0 ? notes : undefined,
  } satisfies Explanation;
}

export async function maybePolishExplanation(
  explanation: Explanation,
  options: {
    config: GuardrailsConfig;
    fireDrill: boolean;
    callLLMFn?: (payload: { systemPrompt: string; userPrompt: string }) => Promise<string>;
  },
): Promise<Explanation> {
  const includeWeights = Boolean((options.config.explain as { includeWeights?: boolean } | undefined)?.includeWeights);

  if (!includeWeights || options.fireDrill || !options.callLLMFn) {
    return explanation;
  }

  const userPrompt =
    `Summary: ${explanation.summary}\n` +
    `Strengths: ${explanation.strengths.join("; ")}\n` +
    `Risks: ${explanation.risks.join("; ")}\n` +
    `Notes: ${(explanation.notes ?? []).join("; ")}`;

  try {
    const polished = await options.callLLMFn({
      systemPrompt:
        "You are a concise recruiter. Polish the summary to be clear and human-friendly without changing the facts.",
      userPrompt,
    });

    const cleaned = polished.trim();

    return { ...explanation, summary: cleaned || explanation.summary } satisfies Explanation;
  } catch {
    return explanation;
  }
}
