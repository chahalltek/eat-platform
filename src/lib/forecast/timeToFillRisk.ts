import {
  intelligenceCache,
  intelligenceCacheKeys,
  INTELLIGENCE_CACHE_TTLS,
  invalidateForecastCachesForTenant,
} from "@/lib/cache/intelligenceCache";
import { prisma } from "@/lib/prisma";
import { startTiming } from "@/lib/observability/timing";

type TimeToFillRiskJob = {
  id: string;
  title: string | null;
  createdAt: Date;
  matchResults: {
    createdAt: Date;
    shortlisted: boolean;
    candidateSignalScore: number | null;
  }[];
  jobCandidates: {
    stages: { enteredAt: Date }[];
  }[];
};

export type TimeToFillRisk = {
  jobId: string;
  jobTitle: string | null;
  estimatedTimeToFillDays: number;
  marketMedianTimeToFillDays: number;
  stageVelocityDays: number | null;
  confidenceHealth: {
    lowShare: number;
    totalSamples: number;
  };
  riskFlags: string[];
};

function derivePredictiveBaselines(jobs: TimeToFillRiskJob[]) {
  const targetShortlistFallback = 3;

  const shortlistCounts = jobs.map((job) => job.matchResults.filter((match) => match.shortlisted).length);
  const targetShortlistSize =
    shortlistCounts.length > 0
      ? Math.max(targetShortlistFallback, shortlistCounts.reduce((sum, count) => sum + count, 0) / shortlistCounts.length)
      : targetShortlistFallback;

  const totalMatches = jobs.reduce((sum, job) => sum + job.matchResults.length, 0);
  const totalShortlisted = jobs.reduce(
    (sum, job) => sum + job.matchResults.filter((match) => match.shortlisted).length,
    0,
  );
  const globalShortlistRate = totalMatches > 0 ? totalShortlisted / totalMatches : 0.2;

  const today = new Date();
  const matchesPerDay: number[] = jobs.map((job) => {
    const daysOpen = Math.max(1, Math.ceil((today.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    return job.matchResults.length / daysOpen;
  });

  const globalMatchesPerDay =
    matchesPerDay.length > 0
      ? matchesPerDay.reduce((sum, value) => sum + value, 0) / matchesPerDay.length || 0.5
      : 0.5;

  return {
    targetShortlistSize,
    globalShortlistRate,
    globalMatchesPerDay,
  };
}

function estimateTimeToFill(job: TimeToFillRiskJob, baselines: ReturnType<typeof derivePredictiveBaselines>) {
  const today = new Date();
  const daysOpen = Math.max(1, Math.ceil((today.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
  const totalMatches = job.matchResults.length;
  const shortlisted = job.matchResults.filter((match) => match.shortlisted).length;

  const matchesPerDay = totalMatches > 0 ? totalMatches / daysOpen : 0;
  const shortlistRate = totalMatches > 0 ? shortlisted / totalMatches : 0;

  const effectiveMatchesPerDay = matchesPerDay > 0 ? matchesPerDay : baselines.globalMatchesPerDay;
  const effectiveShortlistRate = shortlistRate > 0 ? shortlistRate : baselines.globalShortlistRate;

  if (shortlisted >= baselines.targetShortlistSize) {
    return daysOpen;
  }

  const remainingShortlist = Math.max(baselines.targetShortlistSize - shortlisted, 0);
  const expectedMatchesNeeded =
    effectiveShortlistRate > 0 ? remainingShortlist / effectiveShortlistRate : remainingShortlist * 2;
  const expectedDaysRemaining =
    effectiveMatchesPerDay > 0 ? expectedMatchesNeeded / effectiveMatchesPerDay : baselines.targetShortlistSize;

  return Math.max(1, Math.round(daysOpen + expectedDaysRemaining));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function computeStageVelocity(job: TimeToFillRiskJob) {
  const stageDurations: number[] = [];

  for (const candidate of job.jobCandidates) {
    const stages = [...candidate.stages].sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
    for (let i = 1; i < stages.length; i += 1) {
      const deltaDays =
        (stages[i].enteredAt.getTime() - stages[i - 1].enteredAt.getTime()) / (1000 * 60 * 60 * 24);
      stageDurations.push(deltaDays);
    }
  }

  if (stageDurations.length === 0) {
    return null;
  }

  const total = stageDurations.reduce((sum, entry) => sum + entry, 0);
  return total / stageDurations.length;
}

function evaluateConfidenceHealth(job: TimeToFillRiskJob) {
  const buckets = { low: 0, medium: 0, high: 0 };

  for (const match of job.matchResults) {
    const score = typeof match.candidateSignalScore === "number" ? match.candidateSignalScore : null;

    if (score === null) {
      continue;
    }

    if (score >= 70) {
      buckets.high += 1;
    } else if (score >= 45) {
      buckets.medium += 1;
    } else {
      buckets.low += 1;
    }
  }

  const total = buckets.low + buckets.medium + buckets.high;
  const lowShare = total > 0 ? buckets.low / total : 0;

  return { lowShare, totalSamples: total };
}

export function evaluateTimeToFillRisks(jobs: TimeToFillRiskJob[]): TimeToFillRisk[] {
  if (jobs.length === 0) return [];

  const baselines = derivePredictiveBaselines(jobs);
  const forecasts = jobs.map((job) => estimateTimeToFill(job, baselines));
  const marketMedian = median(forecasts);

  return jobs.map((job, index) => {
    const estimatedTimeToFillDays = forecasts[index];
    const stageVelocityDays = computeStageVelocity(job);
    const confidenceHealth = evaluateConfidenceHealth(job);

    const riskFlags: string[] = [];

    if (marketMedian > 0 && estimatedTimeToFillDays >= marketMedian * 1.25) {
      riskFlags.push(
        `Forecast (${estimatedTimeToFillDays}d) exceeds market median (${Math.round(marketMedian)}d), risking delayed fill.`,
      );
    }

    if (stageVelocityDays === null) {
      riskFlags.push("No stage movement recorded; requisition momentum is unclear.");
    } else if (stageVelocityDays > 8) {
      riskFlags.push(`Stage velocity is slow (${stageVelocityDays.toFixed(1)}d per hop), increasing time-to-fill risk.`);
    }

    if (confidenceHealth.totalSamples > 0 && confidenceHealth.lowShare >= 0.35) {
      riskFlags.push(
        `${Math.round(confidenceHealth.lowShare * 100)}% of matches sit in low confidence bands, limiting qualified pipeline.`,
      );
    }

    return {
      jobId: job.id,
      jobTitle: job.title,
      estimatedTimeToFillDays,
      marketMedianTimeToFillDays: marketMedian,
      stageVelocityDays,
      confidenceHealth,
      riskFlags,
    } satisfies TimeToFillRisk;
  });
}

<<<<<<< ours
export async function getTimeToFillRisksForTenant(tenantId: string) {
  const timer = startTiming({ workload: "forecasting_jobs", meta: { tenantId } });

  try {
    const jobs = await prisma.jobReq.findMany({
      where: { tenantId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        matchResults: {
          select: {
            createdAt: true,
            shortlisted: true,
            candidateSignalScore: true,
          },
        },
        jobCandidates: {
          select: {
            stages: {
              select: { enteredAt: true },
              orderBy: { enteredAt: "asc" },
            },
          },
        },
      },
    });

    const totalMatches = jobs.reduce((sum, job) => sum + job.matchResults.length, 0);
    const totalJobCandidates = jobs.reduce((sum, job) => sum + job.jobCandidates.length, 0);

    const risks = evaluateTimeToFillRisks(jobs as TimeToFillRiskJob[]);

    timer.end({
      cache: { hit: false },
      inputSizes: {
        jobs: jobs.length,
        matchSamples: totalMatches,
        jobCandidates: totalJobCandidates,
      },
    });

    return risks;
  } finally {
    timer.end({ cache: { hit: false } });
  }
=======
export async function getTimeToFillRisksForTenant(
  tenantId: string,
  { bypassCache = false }: { bypassCache?: boolean } = {},
) {
  const cacheKey = intelligenceCacheKeys.forecasts(tenantId);

  if (bypassCache) {
    invalidateForecastCachesForTenant(tenantId);
  }

  return intelligenceCache.getOrCreate(
    [cacheKey],
    INTELLIGENCE_CACHE_TTLS.forecastsMs,
    async () => {
      const jobs = await prisma.jobReq.findMany({
        where: { tenantId },
        select: {
          id: true,
          title: true,
          createdAt: true,
          matchResults: {
            select: {
              createdAt: true,
              shortlisted: true,
              candidateSignalScore: true,
            },
          },
          jobCandidates: {
            select: {
              stages: {
                select: { enteredAt: true },
                orderBy: { enteredAt: "asc" },
              },
            },
          },
        },
      });

      return evaluateTimeToFillRisks(jobs as TimeToFillRiskJob[]);
    },
    { bypassCache },
  );
}

export const __testing = {
  invalidateForecastCachesForTenant,
};

export function refreshTimeToFillRisksForTenant(tenantId: string) {
  invalidateForecastCachesForTenant(tenantId);
  return getTimeToFillRisksForTenant(tenantId, { bypassCache: true });
>>>>>>> theirs
}
