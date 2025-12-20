import type { AsyncJobState, BenchmarkRelease, BenchmarkMetric, MatchResult } from "@/server/db/prisma";

import { prisma } from "@/server/db/prisma";

export type CriticalAlertType = "JOB_FAILURE" | "FORECAST_STALE" | "BENCHMARK_MISSING";
export type CriticalAlertSeverity = "warning" | "critical";

export type CriticalAlert = {
  type: CriticalAlertType;
  severity: CriticalAlertSeverity;
  title: string;
  summary: string;
  jobType?: string;
  errorSummary?: string | null;
  nextSteps: string[];
  context: Record<string, unknown>;
};

export type AlertHookConfig = {
  emails?: string[];
  webhookUrl?: string;
};

export type AlertDispatchers = {
  sendEmail?: (payload: AlertDeliveryPayload) => Promise<void>;
  sendWebhook?: (payload: AlertDeliveryPayload) => Promise<void>;
};

export type AlertDeliveryPayload = {
  title: string;
  alerts: Array<Pick<CriticalAlert, "type" | "severity" | "title" | "summary" | "jobType" | "errorSummary" | "nextSteps"> & {
    context: Record<string, unknown>;
  }>;
};

type AlertEvaluationOptions = {
  now?: Date;
  jobFailureThreshold?: number;
  forecastMaxAgeHours?: number;
  minimumBenchmarkMetrics?: number;
};

const DEFAULT_OPTIONS: Required<Omit<AlertEvaluationOptions, "now">> = {
  jobFailureThreshold: 3,
  forecastMaxAgeHours: 24,
  minimumBenchmarkMetrics: 1,
};

async function findRepeatedJobFailures(jobFailureThreshold: number): Promise<CriticalAlert[]> {
  const failedStates = await prisma.asyncJobState.findMany({
    where: { status: "failed" },
    orderBy: { updatedAt: "desc" },
  });

  return failedStates
    .filter((state) => state.retries >= jobFailureThreshold)
    .map<CriticalAlert>((state) => ({
      type: "JOB_FAILURE",
      severity: "critical",
      title: `${state.jobName} is failing repeatedly`,
      summary: `Job has failed ${state.retries} times with last error: ${state.lastError ?? "unknown"}.`,
      jobType: state.jobType,
      errorSummary: state.lastError,
      nextSteps: [
        "Inspect the cron job logs for stack traces and bad inputs.",
        "Check recent deployments or data shape changes that could affect this job type.",
        state.nextRunAt
          ? `Confirm the next scheduled run (${state.nextRunAt.toISOString()}) and adjust backoff if necessary.`
          : "Verify the job is scheduled to retry and not permanently stalled.",
      ],
      context: {
        jobName: state.jobName,
        jobType: state.jobType,
        retries: state.retries,
        lastError: state.lastError,
        lastRunAt: state.lastRunAt,
        nextRunAt: state.nextRunAt,
      },
    }));
}

async function evaluateForecastFreshness(now: Date, forecastMaxAgeHours: number): Promise<CriticalAlert[]> {
  const horizon = new Date(now.getTime() - forecastMaxAgeHours * 60 * 60 * 1000);
  const latestMatch: Pick<MatchResult, "createdAt"> | null = await prisma.matchResult.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latestMatch && latestMatch.createdAt >= horizon) {
    return [] as CriticalAlert[];
  }

  const lastSeen = latestMatch?.createdAt ?? null;

  return [
    {
      type: "FORECAST_STALE",
      severity: "warning",
      title: "Forecast inputs are stale",
      summary: lastSeen
        ? `No new pipeline signals since ${lastSeen.toISOString()}; forecasts are older than ${forecastMaxAgeHours}h.`
        : `No pipeline signals found; forecasts are older than ${forecastMaxAgeHours}h or never generated.`,
      nextSteps: [
        "Trigger a forecast refresh or run matchmaking to produce fresh signals.",
        "Confirm upstream pipelines (ingestion, scoring) are executing on schedule.",
        "Invalidate cached forecasts if inputs have changed materially.",
      ],
      context: { lastSignalAt: lastSeen, horizonHours: forecastMaxAgeHours },
    },
  ];
}

async function evaluateBenchmarkCompleteness(minimumBenchmarkMetrics: number): Promise<CriticalAlert[]> {
  const latestRelease: (BenchmarkRelease & { metrics: BenchmarkMetric[] }) | null =
    await prisma.benchmarkRelease.findFirst({
      where: { status: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { metrics: true },
    });

  if (!latestRelease) {
    return [
      {
        type: "BENCHMARK_MISSING",
        severity: "critical",
        title: "No published benchmark release",
        summary: "A publishable benchmark release was not found; published benchmarks are required for demos.",
        nextSteps: [
          "Run benchmark aggregation to build a release candidate.",
          "Publish the release once metrics are validated.",
          "Invalidate dependent caches after publishing to propagate the new benchmarks.",
        ],
        context: { metrics: 0, releaseId: null },
      },
    ] satisfies CriticalAlert[];
  }

  if (latestRelease.metrics.length >= minimumBenchmarkMetrics) {
    return [] as CriticalAlert[];
  }

  return [
    {
      type: "BENCHMARK_MISSING",
      severity: "critical",
      title: `Benchmark release ${latestRelease.version} is missing metrics`,
      summary: `Published release has ${latestRelease.metrics.length} metrics; expected at least ${minimumBenchmarkMetrics}.`,
      nextSteps: [
        "Re-run benchmark aggregation with sufficient sample sizes.",
        "Verify learning aggregates are being captured for the target window.",
        "Republish the release once metrics reach the minimum bar.",
      ],
      context: {
        releaseId: latestRelease.id,
        version: latestRelease.version,
        metrics: latestRelease.metrics.length,
        windowDays: latestRelease.windowDays,
      },
    },
  ];
}

export async function collectCriticalAlerts(options: AlertEvaluationOptions = {}): Promise<CriticalAlert[]> {
  const now = options.now ?? new Date();
  const settings = { ...DEFAULT_OPTIONS, ...options } as Required<AlertEvaluationOptions> & { now: Date };

  const [jobFailureAlerts, forecastAlerts, benchmarkAlerts] = await Promise.all([
    findRepeatedJobFailures(settings.jobFailureThreshold),
    evaluateForecastFreshness(now, settings.forecastMaxAgeHours),
    evaluateBenchmarkCompleteness(settings.minimumBenchmarkMetrics),
  ]);

  const alerts: CriticalAlert[] = [...jobFailureAlerts, ...forecastAlerts, ...benchmarkAlerts];

  const buildAlertKey = (alert: CriticalAlert) => {
    const jobName = (alert.context as { jobName?: unknown }).jobName;

    if (typeof jobName === "string" && jobName.trim()) {
      return `${alert.type}:${jobName}`;
    }

    return `${alert.type}:${JSON.stringify(alert.context)}`;
  };

  const deduped = alerts.reduce<CriticalAlert[]>((acc, alert) => {
    const duplicate = acc.find((candidate) => buildAlertKey(candidate) === buildAlertKey(alert));

    if (!duplicate) {
      acc.push(alert);
    }

    return acc;
  }, []);

  return deduped;
}

export async function notifyCriticalAlerts(alerts: CriticalAlert[], dispatchers: AlertDispatchers) {
  if (alerts.length === 0) return;

  const payload: AlertDeliveryPayload = {
    title: `Critical platform alerts (${alerts.length})`,
    alerts: alerts.map((alert) => ({
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      summary: alert.summary,
      jobType: alert.jobType,
      errorSummary: alert.errorSummary,
      nextSteps: alert.nextSteps,
      context: alert.context,
    })),
  };

  await Promise.all([
    dispatchers.sendEmail ? dispatchers.sendEmail(payload) : Promise.resolve(),
    dispatchers.sendWebhook ? dispatchers.sendWebhook(payload) : Promise.resolve(),
  ]);
}

