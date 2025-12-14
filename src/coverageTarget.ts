export function combineLabels(primary: string, secondary?: string): string {
  if (!primary && !secondary) {
    return "";
  }

  if (!secondary) {
    return primary;
  }

  return `${primary} / ${secondary}`;
}

export function normalizeScore(score: number, max = 1): number {
  if (max <= 0) {
    throw new Error("max must be positive");
  }

  const bounded = Math.min(Math.max(score, 0), max);
  return Number((bounded / max).toFixed(3));
}
