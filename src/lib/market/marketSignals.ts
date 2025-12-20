import { Prisma } from "@prisma/client";

import {
  intelligenceCache,
  intelligenceCacheKeys,
  INTELLIGENCE_CACHE_TTLS,
} from "@/lib/cache/intelligenceCache";
import { prisma } from "@/server/db/prisma";
import type { SystemModeName } from "@/lib/modes/systemModes";

export type MarketSignals = {
  label: string;
  windowDays: number;
  roleFamily?: string;
  region?: string;
  skillScarcity: {
    roleFamily: string;
    scarcityIndex: number;
    demand: number;
    supply: number;
  }[];
  confidenceByRegion: {
    region: string;
    low: number;
    medium: number;
    high: number;
    total: number;
  }[];
  timeToFillBenchmarks: {
    roleFamily: string;
    region: string;
    averageDays: number;
    p90Days: number;
    sampleSize: number;
  }[];
  oversuppliedRoles: {
    roleFamily: string;
    region: string;
    supplyDemandRatio: number;
    openRoles: number;
    activeCandidates: number;
  }[];
  systemMode: SystemModeName;
  capturedAt: Date;
};

type LearningAggregateRow = {
  roleFamily: string;
  region: string;
  normalizedSkill: string;
  confidence: number;
  timeToFillDays: number;
  openRoles: number;
  activeCandidates: number;
  capturedAt: Date;
};

const ROLLING_WINDOW_DAYS = 90;
const LABEL = "Market benchmark (aggregated)";

async function loadLearningAggregate(bypassCache: boolean) {
  const cacheKey = intelligenceCacheKeys.marketSignals({
    roleFamily: "learning-aggregate",
    region: "learning-aggregate",
    systemMode: "aggregate-source",
  });

  const cached = intelligenceCache.get<LearningAggregateRow[]>(cacheKey);
  if (cached && !bypassCache) return cached;

  const sinceDate = new Date();
  sinceDate.setUTCHours(0, 0, 0, 0);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - (ROLLING_WINDOW_DAYS - 1));

  const sinceParam = bypassCache ? sinceDate : sinceDate.toISOString();
  const rawQuery = Prisma.sql`
    SELECT
      role_family as "roleFamily",
      region,
      normalized_skill as "normalizedSkill",
      confidence,
      time_to_fill_days as "timeToFillDays",
      open_roles as "openRoles",
      active_candidates as "activeCandidates",
      captured_at as "capturedAt"
    FROM "LearningAggregate"
    WHERE captured_at >= ${sinceParam}
  `;

  const rows = await prisma.$queryRaw<LearningAggregateRow[]>(rawQuery);

  intelligenceCache.set(cacheKey, rows, INTELLIGENCE_CACHE_TTLS.marketSignalsMs);
  return rows;
}

function calculateScarcity(rows: LearningAggregateRow[]) {
  const byRoleFamily = new Map<string, { demand: number; supply: number }>();

  for (const row of rows) {
    const current = byRoleFamily.get(row.roleFamily) ?? { demand: 0, supply: 0 };
    current.demand += row.openRoles;
    current.supply += row.activeCandidates;
    byRoleFamily.set(row.roleFamily, current);
  }

  return Array.from(byRoleFamily.entries()).map(([roleFamily, { demand, supply }]) => {
    const ratio = demand / Math.max(1, supply);
    const scarcityIndex = Math.max(0, Math.min(100, Math.round(ratio * 25)));

    return { roleFamily, scarcityIndex, demand, supply };
  });
}

function calculateConfidenceDistribution(rows: LearningAggregateRow[]) {
  const byRegion = new Map<string, { low: number; medium: number; high: number; total: number }>();

  for (const row of rows) {
    const bucket = row.confidence >= 0.66 ? "high" : row.confidence >= 0.33 ? "medium" : "low";
    const current =
      byRegion.get(row.region) ?? ({ low: 0, medium: 0, high: 0, total: 0 } satisfies Record<string, number>);

    current[bucket] += 1;
    current.total += 1;
    byRegion.set(row.region, current);
  }

  return Array.from(byRegion.entries()).map(([region, { low, medium, high, total }]) => ({ region, low, medium, high, total }));
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function calculateTimeToFill(rows: LearningAggregateRow[]) {
  const byKey = new Map<string, number[]>();

  for (const row of rows) {
    const key = `${row.region}::${row.roleFamily}`;
    const list = byKey.get(key) ?? [];
    list.push(row.timeToFillDays);
    byKey.set(key, list);
  }

  return Array.from(byKey.entries()).map(([key, values]) => {
    const [region, roleFamily] = key.split("::");
    const averageDays = values.reduce((sum, value) => sum + value, 0) / values.length;
    const p90Days = percentile(values, 90);

    return { roleFamily, region, averageDays: Math.round(averageDays * 10) / 10, p90Days, sampleSize: values.length };
  });
}

function detectOversupplied(rows: LearningAggregateRow[]) {
  const byKey = new Map<string, { openRoles: number; activeCandidates: number }>();

  for (const row of rows) {
    const key = `${row.region}::${row.roleFamily}`;
    const current = byKey.get(key) ?? { openRoles: 0, activeCandidates: 0 };
    current.openRoles += row.openRoles;
    current.activeCandidates += row.activeCandidates;
    byKey.set(key, current);
  }

  return Array.from(byKey.entries())
    .map(([key, { openRoles, activeCandidates }]) => {
      const [region, roleFamily] = key.split("::");
      const supplyDemandRatio = activeCandidates / Math.max(1, openRoles);

      return { roleFamily, region, supplyDemandRatio, openRoles, activeCandidates };
    })
    .filter((entry) => entry.supplyDemandRatio >= 1.5)
    .sort((a, b) => b.supplyDemandRatio - a.supplyDemandRatio)
    .slice(0, 10);
}

export async function getMarketSignals({
  roleFamily,
  region,
  systemMode = "production",
  timestamp,
  bypassCache = false,
}: {
  roleFamily?: string | null;
  region?: string | null;
  systemMode?: SystemModeName;
  timestamp?: Date;
  bypassCache?: boolean;
}): Promise<MarketSignals> {
  const capturedAt = timestamp ?? new Date();

  if (systemMode === "fire_drill" || systemMode === "demo") {
    return {
      label: LABEL,
      windowDays: ROLLING_WINDOW_DAYS,
      roleFamily: roleFamily ?? undefined,
      region: region ?? undefined,
      skillScarcity: [],
      confidenceByRegion: [],
      timeToFillBenchmarks: [],
      oversuppliedRoles: [],
      systemMode,
      capturedAt,
    } satisfies MarketSignals;
  }

  const aggregateRows = await loadLearningAggregate(bypassCache);
  const filtered = aggregateRows.filter((row) => {
    if (roleFamily && row.roleFamily !== roleFamily) return false;
    if (region && row.region !== region) return false;
    return true;
  });

  const cacheKey = intelligenceCacheKeys.marketSignals({ systemMode, roleFamily, region });

  const cacheOptions = bypassCache ? { bypassCache } : undefined;

  return intelligenceCache.getOrCreate(
    [cacheKey],
    INTELLIGENCE_CACHE_TTLS.marketSignalsMs,
    async () => ({
      label: LABEL,
      windowDays: ROLLING_WINDOW_DAYS,
      roleFamily: roleFamily ?? undefined,
      region: region ?? undefined,
      skillScarcity: calculateScarcity(filtered),
      confidenceByRegion: calculateConfidenceDistribution(filtered),
      timeToFillBenchmarks: calculateTimeToFill(filtered),
      oversuppliedRoles: detectOversupplied(filtered),
      systemMode,
      capturedAt,
    }),
    cacheOptions,
  );
}

export const __testing = {
  resetCache: () => {
    intelligenceCache.invalidateByPrefix(["market-signals"]);
  },
};
