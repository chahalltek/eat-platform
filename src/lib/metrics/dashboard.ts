import { AgentRunStatus } from '@prisma/client';
import { prisma } from '../prisma';

type TimeSeriesBucket = {
  date: string;
  label: string;
  count: number;
};

type ErrorByAgent = {
  agentName: string;
  count: number;
};

type DashboardMetrics = {
  matchesPerDay: TimeSeriesBucket[];
  agentRunsPerDay: TimeSeriesBucket[];
  outreachPerDay: TimeSeriesBucket[];
  errorsByAgent: ErrorByAgent[];
  successfulAgentRuns: {
    current: number;
    previous: number;
  };
  totals: {
    matches: number;
    agentRuns: number;
    outreach: number;
    errors: number;
  };
};

const DAYS_OF_HISTORY = 7;

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

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - (DAYS_OF_HISTORY - 1));

  const previousPeriodStart = new Date(sinceDate);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - DAYS_OF_HISTORY);

  const [matches, agentRuns, outreachInteractions, failedRuns] = await Promise.all([
    prisma.matchResult.findMany({
      where: { createdAt: { gte: sinceDate } },
      select: { createdAt: true },
    }),
    prisma.agentRunLog.findMany({
      where: { startedAt: { gte: sinceDate } },
      select: { startedAt: true },
    }),
    prisma.outreachInteraction.findMany({
      where: { createdAt: { gte: sinceDate } },
      select: { createdAt: true },
    }),
    prisma.agentRunLog.groupBy({
      by: ['agentName'],
      where: { status: AgentRunStatus.FAILED },
      _count: { _all: true },
    }),
  ]);

  const [successfulAgentRunsCurrent, successfulAgentRunsPrevious] = await Promise.all([
    prisma.agentRunLog.count({
      where: {
        status: AgentRunStatus.SUCCESS,
        startedAt: {
          gte: sinceDate,
        },
      },
    }),
    prisma.agentRunLog.count({
      where: {
        status: AgentRunStatus.SUCCESS,
        startedAt: {
          gte: previousPeriodStart,
          lt: sinceDate,
        },
      },
    }),
  ]);

  const matchesPerDay = bucketByDay(matches.map((m) => m.createdAt), DAYS_OF_HISTORY);
  const agentRunsPerDay = bucketByDay(agentRuns.map((run) => run.startedAt), DAYS_OF_HISTORY);
  const outreachPerDay = bucketByDay(outreachInteractions.map((entry) => entry.createdAt), DAYS_OF_HISTORY);

  const errorsByAgent = failedRuns
    .map((run) => ({ agentName: run.agentName, count: run._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    matchesPerDay,
    agentRunsPerDay,
    outreachPerDay,
    errorsByAgent,
    successfulAgentRuns: {
      current: successfulAgentRunsCurrent,
      previous: successfulAgentRunsPrevious,
    },
    totals: {
      matches: matches.length,
      agentRuns: agentRuns.length,
      outreach: outreachInteractions.length,
      errors: failedRuns.reduce((sum, run) => sum + run._count._all, 0),
    },
  };
}
