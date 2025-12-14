import { Prisma } from "@/server/db";

import { prisma } from "@/server/db";

export type IndexComponents = {
  talentScarcityIndex: number;
  hiringVelocityIndex: number;
  marketIntelligenceIndex: number;
  confidenceStabilityIndex: number;
};

export type EteIndexResult = {
  period: string;
  value: number;
  components: IndexComponents;
  headline: string;
  deltaPercent?: number;
  createdAt: Date;
};

type LearningAggregateRow = {
  timeToFillDays: number;
  openRoles: number;
  activeCandidates: number;
  confidence: number;
  capturedAt: Date;
};

const WINDOW_DAYS = 90;
const MIN_TIME_TO_FILL_DAYS = 10;
const MAX_TIME_TO_FILL_DAYS = 120;
const MAX_CONFIDENCE_STD = 0.25;

const WEIGHTS = {
  talentScarcityIndex: 0.35,
  hiringVelocityIndex: 0.25,
  marketIntelligenceIndex: 0.25,
  confidenceStabilityIndex: 0.15,
} as const;

type WeightKey = keyof typeof WEIGHTS;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalize(value: number, min: number, max: number) {
  if (max === min) return 0;

  const bounded = clamp(value, min, max);
  return ((bounded - min) / (max - min)) * 100;
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function calculateStandardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildPeriod(timestamp: Date) {
  const month = timestamp.getUTCMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `${timestamp.getUTCFullYear()}-Q${quarter}`;
}

async function loadLearningSignals(bypassCache: boolean) {
  const sinceDate = new Date();
  sinceDate.setUTCHours(0, 0, 0, 0);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - (WINDOW_DAYS - 1));

  const sinceParam = bypassCache ? sinceDate : sinceDate.toISOString();
  const rawQuery = Prisma.sql`
    SELECT
      time_to_fill_days as "timeToFillDays",
      open_roles as "openRoles",
      active_candidates as "activeCandidates",
      confidence,
      captured_at as "capturedAt"
    FROM "LearningAggregate"
    WHERE captured_at >= ${sinceParam}
  `;

  if (bypassCache) {
    // The caller explicitly requested a fresh pull; do not reuse Prisma's prepared statements cache
    return prisma.$queryRaw<LearningAggregateRow[]>(rawQuery);
  }

  return prisma.$queryRaw<LearningAggregateRow[]>(rawQuery);
}

function calculateComponents(rows: LearningAggregateRow[]): IndexComponents {
  if (rows.length === 0) {
    return {
      talentScarcityIndex: 0,
      hiringVelocityIndex: 0,
      marketIntelligenceIndex: 0,
      confidenceStabilityIndex: 0,
    } satisfies IndexComponents;
  }

  const totalDemand = rows.reduce((sum, row) => sum + row.openRoles, 0);
  const totalSupply = rows.reduce((sum, row) => sum + row.activeCandidates, 0);
  const scarcityRatio = totalDemand / Math.max(1, totalSupply);
  const talentScarcityIndex = round(clamp(scarcityRatio * 25, 0, 100));

  const averageTimeToFill =
    rows.reduce((sum, row) => sum + row.timeToFillDays, 0) / rows.length;
  const hiringVelocityIndex = round(
    100 - normalize(averageTimeToFill, MIN_TIME_TO_FILL_DAYS, MAX_TIME_TO_FILL_DAYS),
  );

  const averageConfidence =
    rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
  const marketIntelligenceIndex = round(normalize(averageConfidence, 0, 1));

  const confidenceStdDev = calculateStandardDeviation(
    rows.map((row) => row.confidence),
  );
  const confidenceStabilityIndex = round(
    100 - normalize(confidenceStdDev, 0, MAX_CONFIDENCE_STD),
  );

  return {
    talentScarcityIndex,
    hiringVelocityIndex,
    marketIntelligenceIndex,
    confidenceStabilityIndex,
  } satisfies IndexComponents;
}

function calculateIndex(components: IndexComponents) {
  const weightedSum = (Object.keys(components) as WeightKey[]).reduce(
    (total, key) => total + components[key] * WEIGHTS[key],
    0,
  );
  return round(weightedSum);
}

function buildHeadline(deltaPercent: number | undefined, value: number) {
  if (deltaPercent === undefined) {
    return `The ETE Index baseline is ${value.toFixed(1)}.`;
  }

  if (Math.abs(deltaPercent) < 1) {
    return `The ETE Index is holding flat (${deltaPercent.toFixed(1)}% QoQ).`;
  }

  const direction = deltaPercent > 0 ? "up" : "down";
  return `The ETE Index shows hiring pressure is ${direction} ${Math.abs(deltaPercent).toFixed(1)}% QoQ.`;
}

export async function buildEteIndex({
  timestamp = new Date(),
  bypassCache = false,
}: { timestamp?: Date; bypassCache?: boolean } = {}): Promise<EteIndexResult> {
  const rows = await loadLearningSignals(bypassCache);
  const components = calculateComponents(rows);
  const value = calculateIndex(components);
  const period = buildPeriod(timestamp);

  const priorSnapshot = await prisma.eteIndexSnapshot.findFirst({
    where: { period: { not: period } },
    orderBy: { createdAt: "desc" },
  });

  const deltaPercent =
    priorSnapshot && priorSnapshot.value !== 0
      ? round(((value - priorSnapshot.value) / Math.abs(priorSnapshot.value)) * 100, 1)
      : priorSnapshot
        ? 0
        : undefined;

  const snapshot = await prisma.eteIndexSnapshot.upsert({
    where: { period },
    update: {
      value,
      components: components as Prisma.InputJsonValue,
    },
    create: {
      period,
      value,
      components: components as Prisma.InputJsonValue,
    },
  });

  return {
    period,
    value,
    components,
    headline: buildHeadline(deltaPercent, value),
    deltaPercent: deltaPercent === undefined ? undefined : round(deltaPercent, 1),
    createdAt: snapshot.createdAt,
  } satisfies EteIndexResult;
}

export const __testing = {
  buildPeriod,
  calculateComponents,
  calculateIndex,
  calculateStandardDeviation,
};
