import { guardrailsPresets, type GuardrailsConfig } from "@/lib/guardrails/presets";

export type Skill = {
  name: string;
  normalizedName?: string;
  required?: boolean;
  weight?: number | null;
};

export type Job = {
  id: string;
  title?: string | null;
  location?: string | null;
  seniorityLevel?: string | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  skills: Skill[];
};

export type Candidate = {
  id: string;
  name?: string | null;
  location?: string | null;
  totalExperienceYears?: number | null;
  seniorityLevel?: string | null;
  skills: Skill[];
};

export type MatchSignals = {
  mustHaveSkillsCoverage: number; // 0–1
  niceToHaveSkillsCoverage: number; // 0–1
  experienceAlignment: number; // 0–1
  locationAlignment: number; // 0–1
};

export type MatchResult = {
  candidateId: string;
  score: number;
  signals: MatchSignals;
};

export type MatchInput = {
  job: Job;
  candidates: Candidate[];
  config: GuardrailsConfig;
};

type Weighting = {
  mustHaveSkills: number;
  niceToHaveSkills: number;
  experience: number;
  location: number;
};

const SIMPLE_DEFAULT_WEIGHTS: Weighting = {
  mustHaveSkills: 0.7,
  niceToHaveSkills: 0.3,
  experience: 0,
  location: 0,
};

const WEIGHTED_DEFAULT_WEIGHTS: Weighting = guardrailsPresets.balanced.scoring
  .weights as Weighting;

function normalizeSkillName(name?: string | null) {
  return (name ?? "").trim().toLowerCase();
}

function normalizeWeights(weights: Partial<Weighting> | undefined, fallback: Weighting): Weighting {
  const merged = { ...fallback, ...(weights ?? {}) } satisfies Weighting;
  const total = Object.values(merged).reduce((sum, value) =>
    typeof value === "number" && !Number.isNaN(value) ? sum + value : sum,
  0);

  if (total <= 0) {
    return fallback;
  }

  return {
    mustHaveSkills: merged.mustHaveSkills / total,
    niceToHaveSkills: merged.niceToHaveSkills / total,
    experience: merged.experience / total,
    location: merged.location / total,
  } satisfies Weighting;
}

function resolveStrategy(config: GuardrailsConfig): "simple" | "weighted" {
  const strategy = (config.scoring as { strategy?: string } | undefined)?.strategy;
  return strategy === "simple" ? "simple" : "weighted";
}

function resolveWeights(config: GuardrailsConfig, strategy: "simple" | "weighted"): Weighting {
  const configuredWeights = (config.scoring as { weights?: Partial<Weighting> } | undefined)?.weights;
  const fallback = strategy === "simple" ? SIMPLE_DEFAULT_WEIGHTS : WEIGHTED_DEFAULT_WEIGHTS;

  return normalizeWeights(configuredWeights, fallback);
}

function resolveMinScore(config: GuardrailsConfig): number {
  const configured =
    (config.scoring as { thresholds?: { minMatchScore?: number } } | undefined)?.thresholds
      ?.minMatchScore ?? 0;
  const numeric = typeof configured === "number" && !Number.isNaN(configured) ? configured : 0;
  const scaled = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.round(scaled));
}

function resolveRequireMustHaves(config: GuardrailsConfig): boolean {
  const { requireMustHaves } = (config.safety as { requireMustHaves?: boolean } | undefined) ?? {};
  return Boolean(requireMustHaves);
}

function getSkillBuckets(job: Job) {
  const mustHave = job.skills.filter((skill) => skill.required);
  const niceToHave = job.skills.filter((skill) => !skill.required);
  return { mustHave, niceToHave };
}

export function calculateSkillCoverage(targetSkills: Skill[], candidateSkills: Skill[]): number {
  const normalizedCandidateSkills = new Set(
    candidateSkills.map((skill) => normalizeSkillName(skill.normalizedName ?? skill.name)),
  );
  const normalizedTargets = targetSkills
    .map((skill) => normalizeSkillName(skill.normalizedName ?? skill.name))
    .filter(Boolean);

  if (normalizedTargets.length === 0) return 1;

  const matched = normalizedTargets.filter((skill) => normalizedCandidateSkills.has(skill)).length;
  return matched / normalizedTargets.length;
}

export function calculateExperienceAlignment(job: Job, candidate: Candidate): number {
  const candidateYears = candidate.totalExperienceYears;
  const minYears = job.minExperienceYears;
  const maxYears = job.maxExperienceYears;

  if (candidateYears === null || candidateYears === undefined) return 0.5;
  if (minYears === null && maxYears === null) return 1;

  if (minYears !== null && minYears !== undefined && candidateYears < minYears) {
    return Math.max(0, Math.min(candidateYears / Math.max(minYears, 1), 1));
  }

  if (maxYears !== null && maxYears !== undefined && candidateYears > maxYears) {
    return Math.max(0, Math.min(Math.max(maxYears, 0) / Math.max(candidateYears, 1), 1));
  }

  return 1;
}

export function calculateLocationAlignment(
  jobLocation?: string | null,
  candidateLocation?: string | null,
): number {
  const job = normalizeSkillName(jobLocation);
  const candidate = normalizeSkillName(candidateLocation);

  if (!job || !candidate) return 0.5;
  if (job === candidate) return 1;

  const remoteHint = job.includes("remote") || candidate.includes("remote");
  if (remoteHint) return 0.8;

  const jobParts = job.split(/,|-/).map((part) => part.trim()).filter(Boolean);
  const candidateParts = candidate.split(/,|-/).map((part) => part.trim()).filter(Boolean);
  const overlap = jobParts.some((part) => candidateParts.includes(part));

  return overlap ? 0.7 : 0.3;
}

function calculateSignals(job: Job, candidate: Candidate): MatchSignals {
  const { mustHave, niceToHave } = getSkillBuckets(job);

  return {
    mustHaveSkillsCoverage: calculateSkillCoverage(mustHave, candidate.skills),
    niceToHaveSkillsCoverage: calculateSkillCoverage(niceToHave, candidate.skills),
    experienceAlignment: calculateExperienceAlignment(job, candidate),
    locationAlignment: calculateLocationAlignment(job.location, candidate.location),
  } satisfies MatchSignals;
}

function scoreSimple(signals: MatchSignals, weights: Weighting): number {
  const skillWeight = weights.mustHaveSkills + weights.niceToHaveSkills;
  const normalizedSkillWeights =
    skillWeight > 0
      ? { mustHave: weights.mustHaveSkills / skillWeight, niceToHave: weights.niceToHaveSkills / skillWeight }
      : { mustHave: 0.5, niceToHave: 0.5 };

  const combined =
    signals.mustHaveSkillsCoverage * normalizedSkillWeights.mustHave +
    signals.niceToHaveSkillsCoverage * normalizedSkillWeights.niceToHave;

  return Math.round(combined * 100);
}

function scoreWeighted(signals: MatchSignals, weights: Weighting): number {
  const weighted =
    signals.mustHaveSkillsCoverage * weights.mustHaveSkills +
    signals.niceToHaveSkillsCoverage * weights.niceToHaveSkills +
    signals.experienceAlignment * weights.experience +
    signals.locationAlignment * weights.location;

  return Math.round(weighted * 100);
}

export function runMatch(input: MatchInput): MatchResult[] {
  const strategy = resolveStrategy(input.config);
  const weights = resolveWeights(input.config, strategy);
  const minScore = resolveMinScore(input.config);
  const requireMustHaves = resolveRequireMustHaves(input.config);

  const results = input.candidates.flatMap((candidate) => {
    const signals = calculateSignals(input.job, candidate);
    const missingMustHaves = requireMustHaves && signals.mustHaveSkillsCoverage < 1;

    const score = missingMustHaves
      ? 0
      : strategy === "simple"
        ? scoreSimple(signals, weights)
        : scoreWeighted(signals, weights);

    if (score < minScore) return [] as MatchResult[];

    return [
      {
        candidateId: candidate.id,
        score,
        signals,
      },
    ];
  });

  return results.sort((a, b) => b.score - a.score);
}
