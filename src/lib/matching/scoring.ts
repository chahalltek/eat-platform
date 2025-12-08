export type MatchContext = {
  jobTitle: string;
  jobSkills: string[];
  candidateTitle?: string | null;
  candidateSkills: string[];
};

export type MatchScoreBreakdown = {
  skillOverlapScore: number;   // 0–100
  titleSimilarityScore: number; // 0–100
  compositeScore: number;      // 0–100
};

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const val of setA) {
    if (setB.has(val)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function titleSimilarity(jobTitle: string, candidateTitle?: string | null): number {
  if (!candidateTitle) return 0;
  const jt = jobTitle.toLowerCase();
  const ct = candidateTitle.toLowerCase();
  if (jt === ct) return 1;
  if (ct.includes(jt) || jt.includes(ct)) return 0.8;
  // very dumb fallback for MVP
  return 0.3;
}

export function computeMatchScore(ctx: MatchContext): MatchScoreBreakdown {
  const skillSim = jaccardSimilarity(ctx.jobSkills, ctx.candidateSkills);
  const titleSim = titleSimilarity(ctx.jobTitle, ctx.candidateTitle);

  const skillOverlapScore = Math.round(skillSim * 100);
  const titleSimilarityScore = Math.round(titleSim * 100);

  // weighted composite: 70% skills, 30% title
  const composite = Math.round(skillOverlapScore * 0.7 + titleSimilarityScore * 0.3);

  return {
    skillOverlapScore,
    titleSimilarityScore,
    compositeScore: composite,
  };
}
