import { guardrailsPresets, type GuardrailsConfig } from "@/lib/guardrails/presets";

export type Skill = { name: string; normalizedName?: string; required?: boolean; weight?: number | null };

export type Job = {
  id: string;
  location?: string | null;
  seniorityLevel?: string | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  skills: Skill[];
};

export type Candidate = {
  id: string;
  location?: string | null;
  totalExperienceYears?: number | null;
  seniorityLevel?: string | null;
  skills: Skill[];
};

export type MatchInput = {
  job: Job;
  candidates: Candidate[];
  config: GuardrailsConfig; // from TenantConfig
};

export type MatchResult = {
  candidateId: string;
  score: number;
  signals: {
    mustHaveSkillsCoverage: number;
    niceToHaveSkillsCoverage: number;
    experienceAlignment: number;
    locationAlignment: number;
    // placeholder for future embeddingSimilarity
  };
};

type NormalizedWeights = {
  mustHaveSkills: number;
  niceToHaveSkills: number;
  experience: number;
  location: number;
};

type NormalizedConfig = {
  strategy: "simple" | "weighted";
  weights: NormalizedWeights;
  thresholds: { minMatchScore: number };
  safety: { requireMustHaves: boolean };
};

function normalizeSkillName(name?: string | null) {
  return (name ?? "").trim().toLowerCase();
}

function normalizeWeights(weights?: Partial<NormalizedWeights>): NormalizedWeights {
  const fallback: NormalizedWeights = {
    mustHaveSkills: 0.4,
    niceToHaveSkills: 0.2,
    experience: 0.25,
    location: 0.15,
  };

  const merged: NormalizedWeights = {
    ...fallback,
    ...(weights ?? {}),
  } as NormalizedWeights;

  const total =
    merged.mustHaveSkills + merged.niceToHaveSkills + merged.experience + merged.location;

  if (total <= 0) {
    return fallback;
  }

  return {
    mustHaveSkills: merged.mustHaveSkills / total,
    niceToHaveSkills: merged.niceToHaveSkills / total,
    experience: merged.experience / total,
    location: merged.location / total,
  } satisfies NormalizedWeights;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  return fallback;
}

function normalizeConfig(config: GuardrailsConfig): NormalizedConfig {
  const presetWeights: Partial<NormalizedWeights> =
    config.scoring?.strategy === "simple"
      ? { mustHaveSkills: 0.7, niceToHaveSkills: 0.3, experience: 0, location: 0 }
      : (guardrailsPresets.balanced.scoring.weights as Partial<NormalizedWeights>);

  const weights = normalizeWeights(
    (config.scoring?.weights as Partial<NormalizedWeights> | undefined) ?? undefined,
  );

  const strategy = config.scoring?.strategy === "simple" ? "simple" : "weighted";
  const threshold = toNumber(
    (config.scoring as { thresholds?: { minMatchScore?: number } } | undefined)?.thresholds?.
      minMatchScore,
    toNumber((guardrailsPresets.balanced.scoring.thresholds as { minMatchScore?: number }).minMatchScore, 0),
  );

  const normalizedThreshold = threshold <= 1 ? threshold * 100 : threshold;
  const safety = (config.safety as { requireMustHaves?: boolean } | undefined) ?? {};

  return {
    strategy,
    weights: strategy === "simple" ? normalizeWeights(presetWeights) : weights,
    thresholds: { minMatchScore: normalizedThreshold },
    safety: { requireMustHaves: Boolean(safety.requireMustHaves) },
  } satisfies NormalizedConfig;
}

function splitSkills(job: Job) {
  const mustHave = job.skills.filter((skill) => skill.required).map((skill) => normalizeSkillName(skill.normalizedName ?? skill.name));
  const niceToHave = job.skills
    .filter((skill) => !skill.required)
    .map((skill) => normalizeSkillName(skill.normalizedName ?? skill.name));

  return { mustHave, niceToHave };
}

function computeCoverage(targets: string[], candidateSkills: Set<string>) {
  if (targets.length === 0) return 1;

  const matched = targets.filter((skill) => candidateSkills.has(skill)).length;
  return matched / targets.length;
}

function computeExperienceAlignment(job: Job, candidate: Candidate): number {
  const candidateYears = candidate.totalExperienceYears ?? null;
  const minYears = job.minExperienceYears ?? null;
  const maxYears = job.maxExperienceYears ?? null;

  if (candidateYears === null || candidateYears === undefined) return 0.5;

  if (minYears === null && maxYears === null) return 1;

  if (minYears !== null && candidateYears < minYears) {
    return Math.max(0, Math.min(candidateYears / Math.max(minYears, 1), 1));
  }

  if (maxYears !== null && candidateYears > maxYears) {
    return Math.max(0, Math.min(maxYears / Math.max(candidateYears, 1), 1));
  }

  return 1;
}

function computeLocationAlignment(jobLocation?: string | null, candidateLocation?: string | null): number {
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

function computeSignals(job: Job, candidate: Candidate) {
  const candidateSkills = new Set(
    candidate.skills.map((skill) => normalizeSkillName(skill.normalizedName ?? skill.name)),
  );
  const { mustHave, niceToHave } = splitSkills(job);

  const mustHaveSkillsCoverage = computeCoverage(mustHave, candidateSkills);
  const niceToHaveSkillsCoverage = computeCoverage(niceToHave, candidateSkills);
  const experienceAlignment = computeExperienceAlignment(job, candidate);
  const locationAlignment = computeLocationAlignment(job.location, candidate.location);

  return {
    mustHaveSkillsCoverage,
    niceToHaveSkillsCoverage,
    experienceAlignment,
    locationAlignment,
  } as const;
}

function scoreSimple(signals: MatchResult["signals"], weights: NormalizedWeights) {
  const weighted =
    signals.mustHaveSkillsCoverage * weights.mustHaveSkills +
    signals.niceToHaveSkillsCoverage * weights.niceToHaveSkills;

  return Math.round(weighted * 100);
}

function scoreWeighted(signals: MatchResult["signals"], weights: NormalizedWeights) {
  const weighted =
    signals.mustHaveSkillsCoverage * weights.mustHaveSkills +
    signals.niceToHaveSkillsCoverage * weights.niceToHaveSkills +
    signals.experienceAlignment * weights.experience +
    signals.locationAlignment * weights.location;

  return Math.round(weighted * 100);
}

export function runMatch(input: MatchInput): MatchResult[] {
  const normalized = normalizeConfig(input.config);

  const results = input.candidates.flatMap((candidate) => {
    const signals = computeSignals(input.job, candidate);
    const missingMustHaves = normalized.safety.requireMustHaves && signals.mustHaveSkillsCoverage < 1;

    const score = (() => {
      if (missingMustHaves) return 0;
      return normalized.strategy === "simple"
        ? scoreSimple(signals, normalized.weights)
        : scoreWeighted(signals, normalized.weights);
    })();

    const aboveThreshold = score >= normalized.thresholds.minMatchScore;

    if (!aboveThreshold) return [] as MatchResult[];

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
