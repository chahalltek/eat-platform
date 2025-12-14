import { beforeEach, describe, expect, it, vi } from "vitest";

import { __testing as cacheTesting } from "@/lib/cache/intelligenceCache";
import { runRiskiestReqs } from "@/lib/agents/l2/riskiestReqs";
import type { TimeToFillRisk } from "@/lib/forecast/timeToFillRisk";

vi.mock("@/lib/forecast/timeToFillRisk", () => ({
  getTimeToFillRisksForTenant: vi.fn(),
}));

const mockRisks: TimeToFillRisk[] = [
  {
    jobId: "job-1",
    jobTitle: "Data Scientist",
    estimatedTimeToFillDays: 52,
    marketMedianTimeToFillDays: 30,
    stageVelocityDays: 9,
    confidenceHealth: { lowShare: 0.42, totalSamples: 12 },
    riskFlags: ["Forecast exceeds market by 20+ days."],
  },
  {
    jobId: "job-2",
    jobTitle: "Product Manager",
    estimatedTimeToFillDays: 41,
    marketMedianTimeToFillDays: 30,
    stageVelocityDays: 6,
    confidenceHealth: { lowShare: 0.2, totalSamples: 5 },
    riskFlags: ["Confidence stable."],
  },
  {
    jobId: "job-3",
    jobTitle: "Backend Engineer",
    estimatedTimeToFillDays: 48,
    marketMedianTimeToFillDays: 30,
    stageVelocityDays: null,
    confidenceHealth: { lowShare: 0, totalSamples: 0 },
    riskFlags: [],
  },
];

describe("runRiskiestReqs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheTesting.clear();
  });

  it("ranks requisitions by combined risk score with rationale and references", async () => {
    const getTimeToFillRisksForTenant = vi.mocked((await import("@/lib/forecast/timeToFillRisk")).getTimeToFillRisksForTenant);
    getTimeToFillRisksForTenant.mockResolvedValue(mockRisks);

    const result = await runRiskiestReqs({ tenantId: "tenant-1" });

    expect(getTimeToFillRisksForTenant).toHaveBeenCalledWith("tenant-1", { bypassCache: false });
    expect(result.question).toBe("RISKIEST_REQS");
    expect(result.items).toHaveLength(3);
    expect(result.items[0].title).toBe("Data Scientist");
    expect(result.items[0].rationale).toContain("Forecast projects 52d to fill versus market median 30d.");
    expect(result.items[0].references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "job_req", id: "job-1" }),
        expect.objectContaining({ type: "signal", label: "Time-to-fill risk forecast" }),
      ]),
    );

    const order = result.items.map((item) => item.title);
    expect(order).toEqual(["Data Scientist", "Backend Engineer", "Product Manager"]);
  });

  it("produces deterministic rankings given the same inputs", async () => {
    const getTimeToFillRisksForTenant = vi.mocked((await import("@/lib/forecast/timeToFillRisk")).getTimeToFillRisksForTenant);
    getTimeToFillRisksForTenant.mockResolvedValue(mockRisks);

    const first = await runRiskiestReqs({ tenantId: "tenant-1" });
    const second = await runRiskiestReqs({ tenantId: "tenant-1" });

    expect(getTimeToFillRisksForTenant).toHaveBeenCalledWith("tenant-1", { bypassCache: false });
    expect(first.items.map((item) => item.title)).toEqual(second.items.map((item) => item.title));
  });
});
