const MS_PER_DAY = 1000 * 60 * 60 * 24;

const toDateOrNull = (value?: Date | string | null): Date | null => {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
};

const recencyScore = (date: Date | null, halfLifeDays: number): number => {
  if (!date || Number.isNaN(date.getTime())) return 50;

  const now = Date.now();
  const deltaDays = (now - date.getTime()) / MS_PER_DAY;
  if (deltaDays <= 0) return 100;

  const decay = Math.exp((-Math.log(2) * deltaDays) / halfLifeDays);
  return Math.round(decay * 100);
};

export type JobFreshnessInput = {
  createdAt: Date;
  updatedAt?: Date | null;
  latestMatchActivity?: Date | null;
};

export type JobFreshnessScore = {
  score: number;
  createdRecency: number;
  activityRecency: number;
  matchRecency: number;
};

export function computeJobFreshnessScore(input: JobFreshnessInput): JobFreshnessScore {
  const createdAt = toDateOrNull(input.createdAt);
  const updatedAt = toDateOrNull(input.updatedAt ?? input.createdAt);
  const latestMatchActivity = toDateOrNull(
    input.latestMatchActivity ?? input.updatedAt ?? input.createdAt,
  );

  const createdRecency = recencyScore(createdAt, 60);
  const activityRecency = recencyScore(updatedAt, 21);
  const matchRecency = recencyScore(latestMatchActivity, 14);

  const score = Math.round(createdRecency * 0.2 + activityRecency * 0.4 + matchRecency * 0.4);

  return { score, createdRecency, activityRecency, matchRecency };
}

export function freshnessLabel(score: number): "fresh" | "warm" | "stale" {
  if (score >= 75) return "fresh";
  if (score >= 45) return "warm";
  return "stale";
}
