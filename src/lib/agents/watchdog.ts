export type WatchdogRunSnapshot = {
  agentName: string;
  status: 'SUCCESS' | 'FAILED';
  durationMs: number;
  outputComplete: boolean;
  errorCategory?: string | null;
  timestamp?: Date;
};

export type WatchdogConfig = {
  windowSize: number;
  minWindow: number;
  failureRateThreshold: number;
  latencyP95ThresholdMs: number;
  incompleteRateThreshold: number;
  rateJitterTolerance: number;
  latencyJitterToleranceMs: number;
};

export type WatchdogAlertType = 'FAILURE_RATE' | 'LATENCY' | 'INCOMPLETE_OUTPUT';

export type WatchdogAlert = {
  type: WatchdogAlertType;
  metric: number;
  threshold: number;
  sampleSize: number;
  tags: string[];
  context: Record<string, unknown>;
};

export type WatchdogReport = {
  summary: {
    sampleSize: number;
    failureRate: number;
    latencyP95Ms: number;
    incompleteOutputRate: number;
  };
  alerts: WatchdogAlert[];
};

const DEFAULT_CONFIG: WatchdogConfig = {
  windowSize: 25,
  minWindow: 5,
  failureRateThreshold: 0.2,
  latencyP95ThresholdMs: 60000,
  incompleteRateThreshold: 0.1,
  rateJitterTolerance: 0.05,
  latencyJitterToleranceMs: 500,
};

function percentile(values: number[], percentileRank: number) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(percentileRank * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function summarizeErrors(samples: WatchdogRunSnapshot[]) {
  const histogram = samples
    .filter((sample) => sample.status === 'FAILED')
    .reduce<Record<string, number>>((acc, sample) => {
      const category = sample.errorCategory?.trim() || 'unknown';
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});

  return Object.entries(histogram)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

function buildTagsForFailures(samples: WatchdogRunSnapshot[]): string[] {
  const tags = new Set<string>(['failure-rate']);
  const histogram = summarizeErrors(samples);

  histogram.slice(0, 3).forEach((entry) => tags.add(`error:${entry.category}`));

  return Array.from(tags);
}

function buildBaseContext(samples: WatchdogRunSnapshot[]) {
  const windowStart = samples[0]?.timestamp ?? null;
  const windowEnd = samples[samples.length - 1]?.timestamp ?? null;
  return {
    sampleSize: samples.length,
    windowStart,
    windowEnd,
    recentErrors: summarizeErrors(samples),
    slowestRuns: [...samples]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 3)
      .map((run) => ({ durationMs: run.durationMs, status: run.status, timestamp: run.timestamp ?? null })),
  } satisfies Record<string, unknown>;
}

export function evaluateWatchdog(
  snapshots: WatchdogRunSnapshot[],
  config: Partial<WatchdogConfig> = {},
): WatchdogReport {
  const settings = { ...DEFAULT_CONFIG, ...config } satisfies WatchdogConfig;
  const window = snapshots.slice(-settings.windowSize);
  const sampleSize = window.length;

  const failures = window.filter((snapshot) => snapshot.status === 'FAILED');
  const incompletes = window.filter((snapshot) => !snapshot.outputComplete);
  const durations = window.map((snapshot) => snapshot.durationMs);

  const failureRate = sampleSize === 0 ? 0 : failures.length / sampleSize;
  const latencyP95Ms = percentile(durations, 0.95);
  const incompleteOutputRate = sampleSize === 0 ? 0 : incompletes.length / sampleSize;

  const alerts: WatchdogAlert[] = [];
  const canAlert = sampleSize >= settings.minWindow;
  const baseContext = buildBaseContext(window);

  if (canAlert && failureRate > settings.failureRateThreshold + settings.rateJitterTolerance) {
    alerts.push({
      type: 'FAILURE_RATE',
      metric: failureRate,
      threshold: settings.failureRateThreshold,
      sampleSize,
      tags: buildTagsForFailures(window),
      context: { ...baseContext, failedRuns: failures.length, failureRate },
    });
  }

  if (canAlert && latencyP95Ms > settings.latencyP95ThresholdMs + settings.latencyJitterToleranceMs) {
    alerts.push({
      type: 'LATENCY',
      metric: latencyP95Ms,
      threshold: settings.latencyP95ThresholdMs,
      sampleSize,
      tags: ['latency', 'p95'],
      context: { ...baseContext, latencyP95Ms },
    });
  }

  if (canAlert && incompleteOutputRate > settings.incompleteRateThreshold + settings.rateJitterTolerance) {
    alerts.push({
      type: 'INCOMPLETE_OUTPUT',
      metric: incompleteOutputRate,
      threshold: settings.incompleteRateThreshold,
      sampleSize,
      tags: ['output:incomplete', 'quality'],
      context: { ...baseContext, incompleteOutputRate },
    });
  }

  return {
    summary: {
      sampleSize,
      failureRate,
      latencyP95Ms,
      incompleteOutputRate,
    },
    alerts,
  } satisfies WatchdogReport;
}
