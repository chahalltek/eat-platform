import { AgentRunStatus } from '@prisma/client';
import { prisma } from '../prisma';

type TimeSeriesBucket = {
  date: string;
  label: string;
  count: number;
};

type CoverageBucket = {
  date: string;
  label: string;
  percent: number | null;
};

type AgentFailureRate = {
  agentName: string;
  failureRate: number;
  failedRuns: number;
  totalRuns: number;
};

type QualityMetrics = {
  coverage: {
    latestPercent: number | null;
    lastUpdated: string | null;
    history: CoverageBucket[];
  };
  runs: {
    total: number;
    perDay: TimeSeriesBucket[];
  };
  errors: {
    total: number;
    failureRate: number;
    byAgent: AgentFailureRate[];
  };
};

const QUALITY_HISTORY_DAYS = 14;

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

function buildCoverageBuckets(days: number): Record<string, CoverageBucket> {
  const buckets: Record<string, CoverageBucket> = {};

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);

    const dateKey = date.toISOString().slice(0, 10);
    buckets[dateKey] = {
      date: dateKey,
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      percent: null,
    };
  }

  return buckets;
}

function bucketRunsByDay(records: Date[], days = QUALITY_HISTORY_DAYS) {
  const buckets = buildDateBuckets(days);

  for (const recordDate of records) {
    const dateKey = new Date(recordDate).toISOString().slice(0, 10);
    if (buckets[dateKey]) {
      buckets[dateKey].count += 1;
    }
  }

  return Object.values(buckets);
}

function bucketCoverageByDay(reports: { createdAt: Date; coveragePercent: number }[], days = QUALITY_HISTORY_DAYS) {
  const buckets = buildCoverageBuckets(days);
  const latestForDay: Record<string, { coveragePercent: number; createdAt: Date }> = {};

  for (const report of reports) {
    const dateKey = new Date(report.createdAt).toISOString().slice(0, 10);
    if (!buckets[dateKey]) continue;

    const existing = latestForDay[dateKey];
    if (!existing || report.createdAt > existing.createdAt) {
      latestForDay[dateKey] = report;
    }
  }

  for (const [dateKey, report] of Object.entries(latestForDay)) {
    buckets[dateKey].percent = Math.round(report.coveragePercent * 10) / 10;
  }

  return Object.values(buckets);
}

function calculateFailureRates(agentRuns: { agentName: string | null; status: AgentRunStatus }[]): AgentFailureRate[] {
  const stats = new Map<string, { total: number; failed: number }>();

  for (const run of agentRuns) {
    const key = run.agentName ?? 'Unknown agent';
    const current = stats.get(key) ?? { total: 0, failed: 0 };
    current.total += 1;
    if (run.status === AgentRunStatus.FAILED) {
      current.failed += 1;
    }
    stats.set(key, current);
  }

  return Array.from(stats.entries())
    .map(([agentName, { total, failed }]) => ({
      agentName,
      failedRuns: failed,
      totalRuns: total,
      failureRate: total === 0 ? 0 : Math.round((failed / total) * 1000) / 10,
    }))
    .sort((a, b) => b.failureRate - a.failureRate || b.failedRuns - a.failedRuns);
}

export async function getQualityMetrics(windowDays = QUALITY_HISTORY_DAYS): Promise<QualityMetrics> {
  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - (windowDays - 1));

  const [agentRuns, latestCoverage, coverageHistory] = await Promise.all([
    prisma.agentRunLog.findMany({
      where: { startedAt: { gte: sinceDate } },
      select: { startedAt: true, status: true, agentName: true },
    }),
    prisma.coverageReport.findFirst({
      orderBy: { createdAt: 'desc' },
    }),
    prisma.coverageReport.findMany({
      where: { createdAt: { gte: sinceDate } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const runsPerDay = bucketRunsByDay(agentRuns.map((run) => run.startedAt), windowDays);
  const failures = agentRuns.filter((run) => run.status === AgentRunStatus.FAILED).length;
  const totalRuns = agentRuns.length;
  const failureRate = totalRuns === 0 ? 0 : Math.round((failures / totalRuns) * 1000) / 10;

  const coverageBuckets = bucketCoverageByDay(coverageHistory, windowDays);

  return {
    coverage: {
      latestPercent: latestCoverage ? Math.round(latestCoverage.coveragePercent * 10) / 10 : null,
      lastUpdated: latestCoverage ? latestCoverage.createdAt.toISOString() : null,
      history: coverageBuckets,
    },
    runs: {
      total: totalRuns,
      perDay: runsPerDay,
    },
    errors: {
      total: failures,
      failureRate,
      byAgent: calculateFailureRates(agentRuns),
    },
  };
}

export async function recordCoverageReport({
  coveragePercent,
  branch = 'main',
  commitSha,
}: {
  coveragePercent: number;
  branch?: string;
  commitSha?: string;
}) {
  if (!Number.isFinite(coveragePercent) || coveragePercent < 0) {
    throw new Error('coveragePercent must be a non-negative number');
  }

  return prisma.coverageReport.create({
    data: {
      coveragePercent,
      branch,
      commitSha,
    },
  });
}
