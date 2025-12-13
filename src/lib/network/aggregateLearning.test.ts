import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MINIMUM_SAMPLE_SIZE, runLearningAggregation } from "./aggregateLearning";

const prismaAdminMock = vi.hoisted(() => ({
  tenant: { findMany: vi.fn() },
  tenantLearningSignal: { findMany: vi.fn() },
  learningAggregate: { deleteMany: vi.fn(), createMany: vi.fn() },
}));

vi.mock("@/lib/prismaAdmin", () => ({
  prismaAdmin: prismaAdminMock,
}));

describe("runLearningAggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores signals below the minimum sample size", async () => {
    prismaAdminMock.tenant.findMany.mockResolvedValue([{ id: "tenant-a" }]);
    prismaAdminMock.tenantLearningSignal.findMany.mockResolvedValue([
      {
        id: "signal-1",
        tenantId: "tenant-a",
        roleFamily: "Data",
        industry: null,
        region: "US",
        signalType: "time_to_fill",
        value: 28,
        sampleSize: 12,
        windowDays: 30,
        capturedAt: new Date("2024-05-12"),
      },
      {
        id: "signal-2",
        tenantId: "tenant-a",
        roleFamily: "Data",
        industry: null,
        region: "US",
        signalType: "time_to_fill",
        value: 45,
        sampleSize: 5,
        windowDays: 30,
        capturedAt: new Date("2024-05-13"),
      },
    ]);

    prismaAdminMock.learningAggregate.deleteMany.mockResolvedValue({ count: 0 });
    prismaAdminMock.learningAggregate.createMany.mockResolvedValue({ count: 1 });

    const summary = await runLearningAggregation({
      minimumSampleSize: DEFAULT_MINIMUM_SAMPLE_SIZE,
      referenceDate: new Date("2024-06-03"),
    });

    expect(prismaAdminMock.tenantLearningSignal.findMany).toHaveBeenCalledWith({
      where: { tenantId: { in: ["tenant-a"] }, sampleSize: { gte: DEFAULT_MINIMUM_SAMPLE_SIZE } },
    });

    expect(prismaAdminMock.learningAggregate.createMany).toHaveBeenCalledWith({
      data: [
        {
          roleFamily: "Data",
          industry: null,
          region: "US",
          signalType: "time_to_fill",
          windowDays: 30,
          sampleSize: 12,
          value: 28,
          createdAt: new Date("2024-06-03"),
        },
      ],
    });

    expect(summary).toEqual({ created: 1, tenantsConsidered: 1, signalsEvaluated: 1 });
  });

  it("excludes tenants who have not opted in", async () => {
    prismaAdminMock.tenant.findMany.mockResolvedValue([{ id: "tenant-opt-in" }]);
    prismaAdminMock.tenantLearningSignal.findMany.mockResolvedValue([
      {
        id: "signal-allowed",
        tenantId: "tenant-opt-in",
        roleFamily: "Design",
        industry: "SaaS",
        region: null,
        signalType: "skill_scarcity",
        value: 0.64,
        sampleSize: 20,
        windowDays: 60,
        capturedAt: new Date("2024-05-10"),
      },
      {
        id: "signal-blocked",
        tenantId: "tenant-opt-out",
        roleFamily: "Design",
        industry: "SaaS",
        region: null,
        signalType: "skill_scarcity",
        value: 0.12,
        sampleSize: 18,
        windowDays: 60,
        capturedAt: new Date("2024-05-10"),
      },
    ]);

    prismaAdminMock.learningAggregate.deleteMany.mockResolvedValue({ count: 0 });
    prismaAdminMock.learningAggregate.createMany.mockResolvedValue({ count: 1 });

    const summary = await runLearningAggregation({ referenceDate: new Date("2024-06-05") });

    expect(prismaAdminMock.tenant.findMany).toHaveBeenCalledWith({
      where: { config: { networkLearningOptIn: true } },
      select: { id: true },
    });

    expect(prismaAdminMock.learningAggregate.createMany).toHaveBeenCalledWith({
      data: [
        {
          roleFamily: "Design",
          industry: "SaaS",
          region: null,
          signalType: "skill_scarcity",
          windowDays: 60,
          sampleSize: 20,
          value: 0.64,
          createdAt: new Date("2024-06-03"),
        },
      ],
    });

    expect(summary).toEqual({ created: 1, tenantsConsidered: 1, signalsEvaluated: 1 });
  });
});
