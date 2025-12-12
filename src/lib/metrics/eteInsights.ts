import { AgentRunStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const DAYS_OF_HISTORY = 7;

export type TimeSeriesBucket = {
  date: string;
  label: string;
  count: number;
};

export type ModeBreakdown = {
  mode: string;
  count: number;
};

export type ShortlistDistributionBucket = {
  size: number;
  jobs: number;
};

export type ErrorRateByAgent = {
  agentName: string;
  failedRuns: number;
  totalRuns: number;
  errorRate: number;
};

export type EteInsightsMetrics = {
  pipelineRuns: TimeSeriesBucket[];
  matchRunsByMode: ModeBreakdown[];
  averageMatchesPerJob: number;
  shortlistDistribution: ShortlistDistributionBucket[];
  errorRateByAgent: ErrorRateByAgent[];
};

function buildDateBuckets(days: number): Record<string, TimeSeriesBucket> {
  const buckets: Record<string, TimeSeriesBucket> = {};

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);

    const dateKey = date.toISOString().slice(0, 10);
    buckets[dateKey] = {
      date: dateKey,
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: 0,
    };
  }

  return buckets;
}

function bucketByDay(records: Date[], days = DAYS_OF_HISTORY) {
  const buckets = buildDateBuckets(days);

  for (const recordDate of records) {
    const dateKey = new Date(recordDate).toISOString().slice(0, 10);
    if (buckets[dateKey]) {
      buckets[dateKey].count += 1;
    }
  }

  return Object.values(buckets);
}

function normalizeMode(mode: string | null): string {
  if (!mode) {
    return 'unknown';
  }

  const normalized = mode.trim().toLowerCase();
  if (normalized === 'ui') {
    return 'ui';
  }

  if (normalized === 'auto' || normalized === 'automation' || normalized === 'scheduled') {
    return 'auto';
  }

  return normalized;
}

export async function getEteInsightsMetrics(tenantId: string): Promise<EteInsightsMetrics> {
  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - (DAYS_OF_HISTORY - 1));

  const [recentAgentRuns, matchRunsByModeRaw, matchesByJob, shortlistedByJob, failedRuns, totalRuns] =
    await Promise.all([
      prisma.agentRun.findMany({
        where: { tenantId, startedAt: { gte: sinceDate } },
        select: { startedAt: true },
      }),
      prisma.agentRun.groupBy({
        by: ['mode'],
        where: { tenantId, startedAt: { gte: sinceDate } },
        _count: { _all: true },
      }),
      prisma.matchResult.groupBy({
        by: ['jobReqId'],
        where: { tenantId },
        _count: { _all: true },
      }),
      prisma.matchResult.groupBy({
        by: ['jobReqId'],
        where: { tenantId, shortlisted: true },
        _count: { _all: true },
      }),
      prisma.agentRunLog.groupBy({
        by: ['agentName'],
        where: { tenantId, status: AgentRunStatus.FAILED, startedAt: { gte: sinceDate } },
        _count: { _all: true },
      }),
      prisma.agentRunLog.groupBy({
        by: ['agentName'],
        where: { tenantId, startedAt: { gte: sinceDate } },
        _count: { _all: true },
      }),
    ]);

  const pipelineRuns = bucketByDay(recentAgentRuns.map((run) => run.startedAt));

  const matchRunsByMode = matchRunsByModeRaw
    .map((entry) => ({ mode: normalizeMode(entry.mode), count: entry._count._all }))
    .reduce<Record<string, ModeBreakdown>>((acc, entry) => {
      const existing = acc[entry.mode];
      if (existing) {
        existing.count += entry.count;
        return acc;
      }

      acc[entry.mode] = entry;
      return acc;
    }, {});

  const matchRunsByModeList = Object.values(matchRunsByMode).sort((a, b) => b.count - a.count);

  const totalMatches = matchesByJob.reduce((sum, job) => sum + job._count._all, 0);
  const averageMatchesPerJob = matchesByJob.length > 0 ? totalMatches / matchesByJob.length : 0;

  const shortlistDistributionMap = shortlistedByJob.reduce<Record<number, number>>((map, job) => {
    const size = job._count._all;
    map[size] = (map[size] ?? 0) + 1;
    return map;
  }, {});

  const shortlistDistribution = Object.entries(shortlistDistributionMap)
    .map(([size, jobs]) => ({ size: Number(size), jobs }))
    .sort((a, b) => a.size - b.size);

  const failureLookup = failedRuns.reduce<Record<string, Prisma.Prisma__AgentRunLogGroupByOutputType>>((acc, run) => {
    acc[run.agentName] = run;
    return acc;
  }, {});

  const errorRateByAgent = totalRuns
    .map((run) => {
      const failed = failureLookup[run.agentName]?._count._all ?? 0;
      const total = run._count._all;
      return {
        agentName: run.agentName,
        failedRuns: failed,
        totalRuns: total,
        errorRate: total > 0 ? failed / total : 0,
      };
    })
    .sort((a, b) => b.errorRate - a.errorRate || b.failedRuns - a.failedRuns);

  return {
    pipelineRuns,
    matchRunsByMode: matchRunsByModeList,
    averageMatchesPerJob,
    shortlistDistribution,
    errorRateByAgent,
  };
}
