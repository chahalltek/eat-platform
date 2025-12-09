export type ConfidenceCategory = "High" | "Medium" | "Low";

export function categorizeConfidence(score?: number | null): ConfidenceCategory | null {
  if (typeof score !== "number") return null;
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

export const LOW_CONFIDENCE_THRESHOLD = 60;
