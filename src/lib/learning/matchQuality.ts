import { JobCandidateStatus } from "@/server/db";

import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { prisma } from "@/server/db";

type MatchQualityComponents = {
  shortlistToInterviewRate: number;
  interviewToHireRate: number;
  averageCandidateFeedback: number;
  timeToFillScore: number;
  averageTimeToFillDays: number;
  baselineTimeToFillDays: number;
};

type MatchQualitySamples = {
  shortlisted: number;
  interviewed: number;
  hired: number;
  feedbackEntries: number;
  timeToFillSamples: number;
  baselineSamples: number;
};

export type MatchQualityResult = {
  mqi: number;
  windowDays: number;
  components: MatchQualityComponents;
  samples: MatchQualitySamples;
};

type CalculateMatchQualityOptions = {
  tenantId: string;
  jobId?: string;
  recruiterId?: string;
  windowDays?: number;
  referenceDate?: Date;
};

type MatchQualityScope = "tenant" | "job" | "recruiter";

type MatchQualitySnapshotPayload = {
  tenantId: string;
  scope: MatchQualityScope;
  scopeRef?: string | null;
  windowDays: number;
  mqi: number;
  components: MatchQualityComponents & { context?: { systemMode: string } };
  capturedAt: Date;
};

const COMPONENT_WEIGHTS = {
  shortlistToInterviewRate: 0.3,
  interviewToHireRate: 0.3,
  averageCandidateFeedback: 0.2,
  timeToFillScore: 0.2,
} as const;

const DEFAULT_WINDOW_DAYS = 30;
const BASELINE_LOOKBACK_DAYS = 180;
const DEFAULT_TIME_TO_FILL_BASELINE = 45;

const SHORTLIST_STATUSES: JobCandidateStatus[] = [
  JobCandidateStatus.SHORTLISTED,
  JobCandidateStatus.SUBMITTED,
  JobCandidateStatus.INTERVIEWING,
  JobCandidateStatus.HIRED,
];

const INTERVIEW_STATUSES: JobCandidateStatus[] = [
  JobCandidateStatus.INTERVIEWING,
  JobCandidateStatus.HIRED,
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function startOfWeek(date: Date) {
  const weekStart = startOfDay(date);
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  return weekStart;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function safeRate(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function mapFeedbackDirection(direction: string | null) {
  if (direction === "UP") return 1;
  if (direction === "DOWN") return 0;
  return 0.5;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeTimeToFillDays(
  hires: { createdAt: Date; updatedAt: Date | null; jobReq?: { id: string; createdAt: Date } | null }[],
) {
  const grouped = hires.reduce<Record<string, number>>((acc, hire) => {
    if (!hire.jobReq) return acc;
    const jobCreated = hire.jobReq.createdAt;
    const hireDate = hire.updatedAt ?? hire.createdAt;
    const daysOpen = Math.max(0, (hireDate.getTime() - jobCreated.getTime()) / (1000 * 60 * 60 * 24));
    const current = acc[hire.jobReq.id] ?? Number.POSITIVE_INFINITY;
    acc[hire.jobReq.id] = Math.min(current, daysOpen);
    return acc;
  }, {});

  return Object.values(grouped);
}

function computeTimeToFillScore(actual: number[], baseline: number[]) {
  if (actual.length === 0) {
    return {
      score: 0.5,
      averageActual: 0,
      averageBaseline: baseline.length > 0 ? average(baseline) : DEFAULT_TIME_TO_FILL_BASELINE,
    };
  }

  const averageActual = average(actual);
  const averageBaseline = baseline.length > 0 ? average(baseline) : DEFAULT_TIME_TO_FILL_BASELINE;

  if (averageBaseline === 0) {
    return { score: 0.5, averageActual, averageBaseline: DEFAULT_TIME_TO_FILL_BASELINE };
  }

  const delta = (averageBaseline - averageActual) / averageBaseline;
  const normalized = clamp((delta + 1) / 2);

  return { score: normalized, averageActual, averageBaseline };
}

export async function calculateMatchQualityIndex(options: CalculateMatchQualityOptions): Promise<MatchQualityResult> {
  const {
    tenantId,
    jobId,
    recruiterId,
    windowDays = DEFAULT_WINDOW_DAYS,
    referenceDate = new Date(),
  } = options;

  const sinceDate = startOfDay(addDays(referenceDate, -(windowDays - 1)));
  const baselineSinceDate = startOfDay(addDays(referenceDate, -(BASELINE_LOOKBACK_DAYS - 1)));

  const [scopedCandidates, baselineHires, feedbackEntries] = await Promise.all([
    prisma.jobCandidate.findMany({
      where: {
        tenantId,
        jobReqId: jobId,
        userId: recruiterId,
        createdAt: { gte: sinceDate },
      },
      select: {
        status: true,
        createdAt: true,
        updatedAt: true,
        jobReq: { select: { id: true, createdAt: true } },
      },
    }),
    prisma.jobCandidate.findMany({
      where: {
        tenantId,
        status: JobCandidateStatus.HIRED,
        createdAt: { gte: baselineSinceDate },
      },
      select: {
        createdAt: true,
        updatedAt: true,
        jobReq: { select: { id: true, createdAt: true } },
      },
    }),
    prisma.matchFeedback.findMany({
      where: {
        tenantId,
        jobReqId: jobId,
        outcome: "HIRED",
        createdAt: { gte: sinceDate },
        jobCandidate: recruiterId ? { userId: recruiterId } : undefined,
      },
      select: { direction: true },
    }),
  ]);

  const shortlisted = scopedCandidates.filter((candidate) => SHORTLIST_STATUSES.includes(candidate.status)).length;
  const interviewed = scopedCandidates.filter((candidate) => INTERVIEW_STATUSES.includes(candidate.status)).length;
  const hired = scopedCandidates.filter((candidate) => candidate.status === JobCandidateStatus.HIRED).length;

  const shortlistToInterviewRate = safeRate(interviewed, shortlisted);
  const interviewToHireRate = safeRate(hired, interviewed);

  const feedbackAverage =
    feedbackEntries.length > 0
      ? average(feedbackEntries.map((entry) => mapFeedbackDirection(entry.direction)))
      : 0.5;

  const timeToFillSamples = computeTimeToFillDays(scopedCandidates.filter((c) => c.status === JobCandidateStatus.HIRED));
  const baselineTimeToFill = computeTimeToFillDays(baselineHires);
  const { score: timeToFillScore, averageActual, averageBaseline } = computeTimeToFillScore(
    timeToFillSamples,
    baselineTimeToFill,
  );

  const normalizedComponents = {
    shortlistToInterviewRate: clamp(shortlistToInterviewRate),
    interviewToHireRate: clamp(interviewToHireRate),
    averageCandidateFeedback: clamp(feedbackAverage),
    timeToFillScore: clamp(timeToFillScore),
  };

  const weightedSum =
    normalizedComponents.shortlistToInterviewRate * COMPONENT_WEIGHTS.shortlistToInterviewRate +
    normalizedComponents.interviewToHireRate * COMPONENT_WEIGHTS.interviewToHireRate +
    normalizedComponents.averageCandidateFeedback * COMPONENT_WEIGHTS.averageCandidateFeedback +
    normalizedComponents.timeToFillScore * COMPONENT_WEIGHTS.timeToFillScore;

  const mqi = Math.round(weightedSum * 1000) / 10;

  return {
    mqi,
    windowDays,
    components: {
      ...normalizedComponents,
      averageTimeToFillDays: Math.round(averageActual * 10) / 10,
      baselineTimeToFillDays: Math.round(averageBaseline * 10) / 10,
    },
    samples: {
      shortlisted,
      interviewed,
      hired,
      feedbackEntries: feedbackEntries.length,
      timeToFillSamples: timeToFillSamples.length,
      baselineSamples: baselineTimeToFill.length,
    },
  } satisfies MatchQualityResult;
}

export async function calculateTenantMatchQuality(
  tenantId: string,
  windows: number[] = [30, 60, 90],
  referenceDate = new Date(),
) {
  const results: MatchQualityResult[] = [];

  for (const window of windows) {
    const result = await calculateMatchQualityIndex({ tenantId, windowDays: window, referenceDate });
    results.push(result);
  }

  return results;
}

export async function captureWeeklyMatchQualitySnapshots(
  tenantId: string,
  options?: { windows?: number[]; referenceDate?: Date },
) {
  const mode = await loadTenantMode(tenantId);
  if (mode.mode === "fire_drill" || mode.mode === "demo") {
    return [] as MatchQualitySnapshotPayload[];
  }

  const windows = options?.windows ?? [30, 60, 90];
  const referenceDate = options?.referenceDate ?? new Date();
  const capturedAt = startOfWeek(referenceDate);

  const results = await calculateTenantMatchQuality(tenantId, windows, referenceDate);

  const snapshots: MatchQualitySnapshotPayload[] = results.map((entry) => ({
    tenantId,
    scope: "tenant",
    scopeRef: null,
    windowDays: entry.windowDays,
    mqi: entry.mqi,
    components: { ...entry.components, context: { systemMode: mode.mode } },
    capturedAt,
  }));

  if (snapshots.length === 0) return snapshots;

  await prisma.matchQualitySnapshot.deleteMany({
    where: { tenantId, scope: "tenant", capturedAt: { gte: capturedAt } },
  });

  await prisma.matchQualitySnapshot.createMany({ data: snapshots });

  return snapshots;
}
