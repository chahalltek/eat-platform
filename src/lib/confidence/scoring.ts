<<<<<<< ours
export type ComputeConfidenceScoreInput = {
=======
export type ConfidenceContext = {
>>>>>>> theirs
  jobSkills: string[];
  candidateSkills: string[];
  hasTitle: boolean;
  hasLocation: boolean;
<<<<<<< ours
  createdAt: Date;
};

export type ConfidenceBreakdown = {
  total: number;
  skillOverlap: number;
  metadataScore: number;
  recencyScore: number;
};

// Basic confidence scoring based on skill overlap, metadata completeness, and recency.
export function computeConfidenceScore({
  jobSkills,
  candidateSkills,
  hasTitle,
  hasLocation,
  createdAt,
}: ComputeConfidenceScoreInput): ConfidenceBreakdown {
  const normalizedJobSkills = new Set(jobSkills.map((skill) => skill.toLowerCase()));
  const normalizedCandidateSkills = new Set(candidateSkills.map((skill) => skill.toLowerCase()));

  const overlapCount = [...normalizedCandidateSkills].filter((skill) => normalizedJobSkills.has(skill))
    .length;
  const skillOverlap = Math.min(100, Math.round((overlapCount / Math.max(normalizedJobSkills.size || 1, 1)) * 100));

  const metadataScore = (hasTitle ? 40 : 0) + (hasLocation ? 40 : 0);

  const daysSinceCreation = Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, Math.min(100, Math.round(100 - daysSinceCreation)));

  const total = Math.round(skillOverlap * 0.5 + metadataScore * 0.3 + recencyScore * 0.2);

  return { total, skillOverlap, metadataScore, recencyScore };
=======
  createdAt: Date; // candidate createdAt
};

export type ConfidenceBreakdown = {
  dataCompleteness: number; // 0–40
  skillCoverage: number; // 0–40
  recency: number; // 0–20
  total: number; // 0–100
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// reuse a simple similarity measure
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const val of setA) {
    if (setB.has(val)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Very simple recency score:
 * - 0–30 days old: full 1.0
 * - 30–180 days: linear down to 0.2
 * - 180+ days: 0.1
 */
function recencyFactor(createdAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 30) return 1.0;
  if (diffDays >= 180) return 0.1;

  // linear from 30 -> 180 days = 1.0 -> 0.2
  const t = (diffDays - 30) / (180 - 30); // 0–1
  const value = 1.0 - t * 0.8;
  return clamp(value, 0.1, 1.0);
}

/**
 * Compute a 0–100 confidence score based on:
 * - profile completeness
 * - skill overlap quality
 * - recency
 */
export function computeConfidenceScore(
  ctx: ConfidenceContext
): ConfidenceBreakdown {
  // 1) Data completeness (0–40)
  let completeness = 0;
  if (ctx.hasTitle) completeness += 15;
  if (ctx.hasLocation) completeness += 5;

  // reward having more than a trivial set of skills
  const skillCount = ctx.candidateSkills.length;
  if (skillCount >= 5) completeness += 20;
  else if (skillCount >= 3) completeness += 10;
  else if (skillCount >= 1) completeness += 5;

  completeness = clamp(completeness, 0, 40);

  // 2) Skill coverage (0–40)
  const skillSim = jaccardSimilarity(ctx.jobSkills, ctx.candidateSkills);
  const skillCoverage = clamp(Math.round(skillSim * 40), 0, 40);

  // 3) Recency (0–20)
  const recency = clamp(Math.round(recencyFactor(ctx.createdAt) * 20), 0, 20);

  const totalRaw = completeness + skillCoverage + recency;
  const total = clamp(Math.round(totalRaw), 0, 100);

  return {
    dataCompleteness: completeness,
    skillCoverage,
    recency,
    total,
  };
>>>>>>> theirs
}
