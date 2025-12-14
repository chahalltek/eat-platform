import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: { copilotAudit: { create: vi.fn() } } }));

vi.mock("@/lib/llm", () => ({
  callLLM: vi.fn().mockResolvedValue(
    JSON.stringify({ answer: "Test answer", bullets: ["Bullet"], confidence: "high", caveats: [] }),
  ),
}));

import { generateStrategicCopilotResponse, type EvidencePack } from "./strategicCopilot";

describe("generateStrategicCopilotResponse", () => {
  it("drops to low confidence when evidence is missing", async () => {
    const evidencePack: EvidencePack = {
      benchmarks: {
        id: "release-1",
        version: "2026-Q1",
        title: "ETE Benchmark 2026-Q1",
        status: "published",
        publishedAt: new Date(),
        metricKeys: [],
        metrics: [],
      } as unknown as EvidencePack["benchmarks"],
      forecasts: [
        {
          jobId: "job-1",
          jobTitle: "Designer",
          estimatedTimeToFillDays: 42,
          marketMedianTimeToFillDays: 30,
          stageVelocityDays: 5,
          confidenceHealth: { lowShare: 0, totalSamples: 0 },
          riskFlags: [],
        },
      ],
      marketSignals: null,
      mqiSignals: [
        {
          id: "signal-1",
          tenantId: "tenant-1",
          capturedAt: new Date(),
          roleFamily: "Design",
          signalType: "mqi",
          payload: {},
        },
      ] as unknown as EvidencePack["mqiSignals"],
      l2Results: [
        {
          id: "signal-2",
          tenantId: "tenant-1",
          capturedAt: new Date(),
          roleFamily: "Design",
          signalType: "l2_result",
          payload: {},
        },
      ] as unknown as EvidencePack["l2Results"],
    };

    const response = await generateStrategicCopilotResponse({
      request: { tenantId: "tenant-1", userId: "user-1", query: "Where are we at?" },
      evidencePack,
    });

    expect(response.confidence).toBe("low");
    expect(response.caveats).toContain("Market signals are unavailable right now.");
  });
});
