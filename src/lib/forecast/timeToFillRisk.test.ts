import { describe, expect, it, vi } from "vitest";

import { evaluateTimeToFillRisks, getTimeToFillRisksForTenant } from "./timeToFillRisk";

vi.mock("@/server/db", () => ({
  prisma: {
    jobReq: {
      findMany: vi.fn(),
    },
  },
}));

describe("evaluateTimeToFillRisks", () => {
  it("flags risks based on forecast, stage velocity, and confidence mix", () => {
    vi.setSystemTime(new Date("2024-01-15T00:00:00.000Z"));

    const risks = evaluateTimeToFillRisks([
      {
        id: "job-1",
        title: "Data Engineer",
        createdAt: new Date("2023-12-15T00:00:00.000Z"),
        matchResults: [
          { createdAt: new Date("2024-01-01T00:00:00.000Z"), shortlisted: false, candidateSignalScore: 30 },
          { createdAt: new Date("2024-01-02T00:00:00.000Z"), shortlisted: false, candidateSignalScore: 50 },
          { createdAt: new Date("2024-01-03T00:00:00.000Z"), shortlisted: true, candidateSignalScore: 35 },
        ],
        jobCandidates: [
          {
            stages: [
              { enteredAt: new Date("2023-12-20T00:00:00.000Z") },
              { enteredAt: new Date("2024-01-10T00:00:00.000Z") },
            ],
          },
        ],
      },
      {
        id: "job-2",
        title: "Product Manager",
        createdAt: new Date("2024-01-08T00:00:00.000Z"),
        matchResults: [
          { createdAt: new Date("2024-01-10T00:00:00.000Z"), shortlisted: true, candidateSignalScore: 80 },
          { createdAt: new Date("2024-01-11T00:00:00.000Z"), shortlisted: true, candidateSignalScore: 75 },
        ],
        jobCandidates: [
          {
            stages: [
              { enteredAt: new Date("2024-01-09T00:00:00.000Z") },
              { enteredAt: new Date("2024-01-12T00:00:00.000Z") },
            ],
          },
        ],
      },
    ]);

    const slowJob = risks.find((risk) => risk.jobId === "job-1");
    expect(slowJob?.riskFlags).toEqual(
      expect.arrayContaining([
        expect.stringContaining("exceeds market median"),
        expect.stringContaining("Stage velocity is slow"),
        expect.stringContaining("low confidence bands"),
      ]),
    );

    const healthyJob = risks.find((risk) => risk.jobId === "job-2");
    expect(healthyJob?.riskFlags).toEqual([]);
  });
});

describe("getTimeToFillRisksForTenant", () => {
  it("loads jobs for the tenant and evaluates risks", async () => {
    const { prisma } = await import("@/server/db");
    (prisma.jobReq.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "job-3",
        title: "QA Analyst",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        matchResults: [],
        jobCandidates: [],
      },
    ]);

    const results = await getTimeToFillRisksForTenant("tenant-123");

    expect(prisma.jobReq.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-123" } }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ jobId: "job-3" });
  });
});
