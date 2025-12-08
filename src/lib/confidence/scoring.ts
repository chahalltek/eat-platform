export type ComputeConfidenceScoreInput = {
  jobSkills: string[];
  candidateSkills: string[];
  hasTitle: boolean;
  hasLocation: boolean;
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
}
