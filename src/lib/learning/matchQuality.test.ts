/// <reference types="vitest/globals" />

const JobCandidateStatus = vi.hoisted(() => ({
  POTENTIAL: "POTENTIAL",
  SHORTLISTED: "SHORTLISTED",
  INTERVIEWING: "INTERVIEWING",
  HIRED: "HIRED",
})) as const;

const prisma = vi.hoisted(() => ({
  jobCandidate: { findMany: vi.fn() },
  matchFeedback: { findMany: vi.fn() },
  matchQualitySnapshot: { deleteMany: vi.fn(), createMany: vi.fn() },
  tenant: { findMany: vi.fn() },
}));

vi.mock("@/server/db/prisma", () => ({
  JobCandidateStatus,
  prisma,
}));

import { calculateMatchQualityIndex, captureWeeklyMatchQualitySnapshots } from "./matchQuality";

const mockLoadTenantMode = vi.fn();

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: (...args: unknown[]) => mockLoadTenantMode(...args),
}));

describe("calculateMatchQualityIndex", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-15T00:00:00.000Z"));
    vi.clearAllMocks();
    mockLoadTenantMode.mockResolvedValue({ mode: "pilot" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes weighted MQI with component breakdowns", async () => {
    const prisma = await import("@/server/db/prisma");

    vi.mocked(prisma.prisma.jobCandidate.findMany)
      .mockResolvedValueOnce([
        {
          status: JobCandidateStatus.SHORTLISTED,
          createdAt: new Date("2025-02-01T00:00:00.000Z"),
          updatedAt: new Date("2025-02-05T00:00:00.000Z"),
          jobReq: { id: "job-1", createdAt: new Date("2025-01-25T00:00:00.000Z") },
        },
        {
          status: JobCandidateStatus.INTERVIEWING,
          createdAt: new Date("2025-02-02T00:00:00.000Z"),
          updatedAt: new Date("2025-02-07T00:00:00.000Z"),
          jobReq: { id: "job-1", createdAt: new Date("2025-01-25T00:00:00.000Z") },
        },
        {
          status: JobCandidateStatus.HIRED,
          createdAt: new Date("2025-02-03T00:00:00.000Z"),
          updatedAt: new Date("2025-02-12T00:00:00.000Z"),
          jobReq: { id: "job-1", createdAt: new Date("2025-01-25T00:00:00.000Z") },
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          createdAt: new Date("2024-09-01T00:00:00.000Z"),
          updatedAt: new Date("2024-09-25T00:00:00.000Z"),
          jobReq: { id: "job-baseline-1", createdAt: new Date("2024-08-15T00:00:00.000Z") },
        },
        {
          createdAt: new Date("2024-09-10T00:00:00.000Z"),
          updatedAt: new Date("2024-09-28T00:00:00.000Z"),
          jobReq: { id: "job-baseline-2", createdAt: new Date("2024-08-20T00:00:00.000Z") },
        },
      ] as never);

    vi.mocked(prisma.prisma.matchFeedback.findMany).mockResolvedValue([
      { direction: "UP" },
      { direction: "DOWN" },
    ] as never);

    const result = await calculateMatchQualityIndex({ tenantId: "tenant-1", windowDays: 30 });

    expect(result.samples).toEqual(
      expect.objectContaining({ shortlisted: 3, interviewed: 2, hired: 1, feedbackEntries: 2 }),
    );
    expect(result.components.shortlistToInterviewRate).toBeCloseTo(2 / 3);
    expect(result.components.interviewToHireRate).toBeCloseTo(0.5);
    expect(result.components.averageCandidateFeedback).toBe(0.5);
    expect(result.components.timeToFillScore).toBeGreaterThan(0.7);
    expect(result.mqi).toBeCloseTo(60.5, 1);
  });
});

describe("captureWeeklyMatchQualitySnapshots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-17T10:00:00.000Z"));
    vi.clearAllMocks();
    mockLoadTenantMode.mockResolvedValue({ mode: "production" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures weekly tenant snapshots for MQI windows", async () => {
    const prisma = await import("@/server/db/prisma");

    vi.mocked(prisma.prisma.jobCandidate.findMany)
      .mockResolvedValueOnce([
        {
          status: JobCandidateStatus.HIRED,
          createdAt: new Date("2025-02-10T00:00:00.000Z"),
          updatedAt: new Date("2025-02-15T00:00:00.000Z"),
          jobReq: { id: "job-1", createdAt: new Date("2025-02-01T00:00:00.000Z") },
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          createdAt: new Date("2024-10-01T00:00:00.000Z"),
          updatedAt: new Date("2024-10-20T00:00:00.000Z"),
          jobReq: { id: "job-baseline", createdAt: new Date("2024-09-15T00:00:00.000Z") },
        },
      ] as never);

    vi.mocked(prisma.prisma.matchFeedback.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.prisma.matchQualitySnapshot.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.prisma.matchQualitySnapshot.createMany).mockResolvedValue({ count: 1 } as never);

    const snapshots = await captureWeeklyMatchQualitySnapshots("tenant-1", { windows: [30] });

    expect(prisma.prisma.matchQualitySnapshot.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          capturedAt: { gte: new Date("2025-02-17T00:00:00.000Z") },
          scope: "tenant",
          tenantId: "tenant-1",
        },
      }),
    );
    expect(prisma.prisma.matchQualitySnapshot.createMany).toHaveBeenCalled();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual(
      expect.objectContaining({
        scope: "tenant",
        windowDays: 30,
        capturedAt: new Date("2025-02-17T00:00:00.000Z"),
      }),
    );
    expect((snapshots[0].components as { context?: { systemMode?: string } }).context).toEqual({
      systemMode: "production",
    });
  });

  it("skips snapshot capture when Fire Drill mode is active", async () => {
    const prisma = await import("@/server/db/prisma");

    mockLoadTenantMode.mockResolvedValueOnce({ mode: "fire_drill" });

    const snapshots = await captureWeeklyMatchQualitySnapshots("tenant-1", { windows: [30] });

    expect(prisma.prisma.matchQualitySnapshot.deleteMany).not.toHaveBeenCalled();
    expect(prisma.prisma.matchQualitySnapshot.createMany).not.toHaveBeenCalled();
    expect(snapshots).toEqual([]);
  });
});
