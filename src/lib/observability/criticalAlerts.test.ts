import type { AsyncJobState, BenchmarkRelease, BenchmarkMetric, MatchResult } from "@/server/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { collectCriticalAlerts, notifyCriticalAlerts, type CriticalAlert } from "./criticalAlerts";

const { mockAsyncJobStateFindMany, mockMatchResultFindFirst, mockBenchmarkReleaseFindFirst } = vi.hoisted(() => ({
  mockAsyncJobStateFindMany: vi.fn<[], Promise<AsyncJobState[]>>(),
  mockMatchResultFindFirst: vi.fn<[], Promise<Pick<MatchResult, "createdAt"> | null>>(),
  mockBenchmarkReleaseFindFirst: vi.fn<[], Promise<(BenchmarkRelease & { metrics: BenchmarkMetric[] }) | null>>(),
}));

vi.mock("@/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db")>();

  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      asyncJobState: { findMany: mockAsyncJobStateFindMany },
      matchResult: { findFirst: mockMatchResultFindFirst },
      benchmarkRelease: { findFirst: mockBenchmarkReleaseFindFirst },
    },
  };
});

function buildJobState(overrides: Partial<AsyncJobState>): AsyncJobState {
  const now = new Date();
  return {
    id: "job-state",
    jobName: "learning-aggregate",
    jobType: "aggregation",
    status: "failed",
    retries: 0,
    lastError: null,
    lastRunAt: now,
    nextRunAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as AsyncJobState;
}

function buildBenchmarkRelease(metrics: BenchmarkMetric[], overrides: Partial<BenchmarkRelease> = {}): BenchmarkRelease & {
  metrics: BenchmarkMetric[];
} {
  const now = new Date();
  return {
    id: "release-1",
    version: "v1",
    status: "published",
    windowDays: 30,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
    metrics,
  } as BenchmarkRelease & { metrics: BenchmarkMetric[] };
}

describe("critical alert evaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsyncJobStateFindMany.mockResolvedValue([]);
    mockMatchResultFindFirst.mockResolvedValue({ createdAt: new Date() });
    mockBenchmarkReleaseFindFirst.mockResolvedValue(buildBenchmarkRelease([{ id: "metric-1" } as BenchmarkMetric]));
  });

  it("surfaces repeated job failures with job type and remediation steps", async () => {
    mockAsyncJobStateFindMany.mockResolvedValue([
      buildJobState({ retries: 1, lastError: "intermittent" }),
      buildJobState({
        jobName: "match-quality-snapshot",
        jobType: "benchmark",
        retries: 4,
        lastError: "timeout talking to database",
      }),
    ]);

    const alerts = await collectCriticalAlerts({ jobFailureThreshold: 3 });
    const jobAlert = alerts.find((alert) => alert.type === "JOB_FAILURE");

    expect(jobAlert).toBeDefined();
    expect(jobAlert?.jobType).toBe("benchmark");
    expect(jobAlert?.errorSummary).toContain("timeout");
    expect(jobAlert?.nextSteps.length).toBeGreaterThan(0);
  });

  it("raises a forecast freshness alert when match inputs are stale", async () => {
    mockMatchResultFindFirst.mockResolvedValue({ createdAt: new Date("2024-01-01T00:00:00.000Z") });

    const alerts = await collectCriticalAlerts({ forecastMaxAgeHours: 12, now: new Date("2024-01-02T12:00:00.000Z") });
    const staleAlert = alerts.find((alert) => alert.type === "FORECAST_STALE");

    expect(staleAlert).toBeDefined();
    expect(staleAlert?.context.lastSignalAt).toBeInstanceOf(Date);
    expect(staleAlert?.nextSteps[0]).toMatch(/refresh/i);
  });

  it("alerts when a published benchmark release has no metrics", async () => {
    mockBenchmarkReleaseFindFirst.mockResolvedValue(buildBenchmarkRelease([], { version: "v2" }));

    const alerts = await collectCriticalAlerts({ minimumBenchmarkMetrics: 2 });
    const benchmarkAlert = alerts.find((alert) => alert.type === "BENCHMARK_MISSING");

    expect(benchmarkAlert).toBeDefined();
    expect(benchmarkAlert?.summary).toContain("expected at least 2");
    expect(benchmarkAlert?.nextSteps.some((step) => /re-run/i.test(step))).toBe(true);
  });
});

describe("alert delivery", () => {
  it("sends alerts to both email and webhook dispatchers", async () => {
    const sendEmail = vi.fn<[], Promise<void>>().mockResolvedValue();
    const sendWebhook = vi.fn<[], Promise<void>>().mockResolvedValue();

    const alerts: CriticalAlert[] = [
      {
        type: "JOB_FAILURE",
        severity: "critical",
        title: "Job failed",
        summary: "Job failed repeatedly",
        jobType: "aggregation",
        errorSummary: "boom",
        nextSteps: ["retry"],
        context: { jobName: "learning-aggregate" },
      },
    ];

    await notifyCriticalAlerts(alerts, { sendEmail, sendWebhook });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendWebhook).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ alerts: expect.arrayContaining([expect.objectContaining({ jobType: "aggregation" })]) }),
    );
  });
});

