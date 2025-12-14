import { describe, expect, it, vi } from "vitest";

import { runConfidence } from "@/lib/agents/confidence";

vi.mock("@/server/db", () => ({
  prisma: {
    matchResult: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-123"),
}));

vi.mock("@/lib/agents/confidenceEngine", () => ({
  runConfidenceAgent: vi.fn(),
}));

vi.mock("@/lib/agents/agentRun", () => ({
  withAgentRun: vi.fn(async (_meta, fn) => {
    const output = await fn();
    if (typeof output === "object" && output !== null && "result" in output) {
      return [(output as { result: unknown }).result, "agent-run-1"];
    }
    return [output, "agent-run-1"];
  }),
}));

describe("runConfidence", () => {
  it("loads match results and routes them through the confidence engine", async () => {
    const prisma = await import("@/server/db");
    const { runConfidenceAgent } = await import("@/lib/agents/confidenceEngine");
    vi.mocked(prisma.prisma.matchResult.findMany).mockResolvedValue([
      {
        candidateId: "cand-1",
        score: 80,
        candidateSignalBreakdown: { confidence: { reasons: ["Existing"] } },
      },
      {
        candidateId: "cand-2",
        score: 55,
        candidateSignalBreakdown: null,
      },
    ] satisfies Array<{ candidateId: string; score: number; candidateSignalBreakdown: unknown }>);

    vi.mocked(runConfidenceAgent).mockResolvedValue({
      jobId: "job-1",
      results: [
        { candidateId: "cand-1", score: 0.8, confidenceBand: "HIGH", confidenceReasons: ["Existing"] },
        { candidateId: "cand-2", score: 0.55, confidenceBand: "LOW", confidenceReasons: [] },
      ],
    });

    const result = await runConfidence({ jobId: "job-1" });

    expect(prisma.prisma.matchResult.findMany).toHaveBeenCalledWith({
      where: { jobReqId: "job-1", tenantId: "tenant-123" },
      select: { candidateId: true, score: true, candidateSignalBreakdown: true },
    });
    expect(runConfidenceAgent).toHaveBeenCalledWith({
      matchResults: [
        { candidateId: "cand-1", score: 80, signals: { notes: ["Existing"] } },
        { candidateId: "cand-2", score: 55, signals: undefined },
      ],
      job: { id: "job-1" },
      tenantId: "tenant-123",
    });
    expect(result).toEqual({
      jobId: "job-1",
      results: [
        { candidateId: "cand-1", score: 0.8, confidenceBand: "HIGH", confidenceReasons: ["Existing"] },
        { candidateId: "cand-2", score: 0.55, confidenceBand: "LOW", confidenceReasons: [] },
      ],
    });
  });
});
