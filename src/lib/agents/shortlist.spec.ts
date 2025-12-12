import { beforeEach, describe, expect, it, vi } from "vitest";

import { runShortlist } from "@/lib/agents/shortlist";
import { guardrailsPresets } from "@/lib/guardrails/presets";

const mockJobFindUnique = vi.fn();
const mockWithAgentRun = vi.fn(async (_meta, fn) => {
  const result = await fn();

  if (result && typeof result === "object" && "result" in (result as Record<string, unknown>)) {
    return [(result as { result: unknown }).result, "run-123"];
  }

  return [result, "run-123"];
});
const mockSetShortlistState = vi.fn();
const mockLoadTenantMode = vi.fn(async () => ({
  mode: "production",
  guardrailsPreset: "balanced",
  agentsEnabled: [],
  source: "database",
}));

vi.mock("@/lib/agents/availability", () => ({
  assertAgentEnabled: vi.fn(),
}));

vi.mock("@/lib/agents/agentRun", () => ({
  withAgentRun: (...args: unknown[]) => mockWithAgentRun(...args),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-123" })),
}));

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: (...args: unknown[]) => mockLoadTenantMode(...args),
}));

vi.mock("@/lib/matching/shortlist", () => ({
  setShortlistState: (...args: unknown[]) => mockSetShortlistState(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    job: { findUnique: (...args: unknown[]) => mockJobFindUnique(...args) },
    $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn({}),
  },
}));

describe("runShortlist", () => {
  const guardrails = {
    ...guardrailsPresets.balanced,
    shortlist: { strategy: "quality", maxCandidates: 2 },
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadTenantMode.mockResolvedValue({
      mode: "production",
      guardrailsPreset: "balanced",
      agentsEnabled: [],
      source: "database",
    });
  });

  it("uses quality strategy ordering and thresholds", async () => {
    mockJobFindUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      matches: [
        { candidateId: "cand-1", matchScore: 80, confidence: 90 },
        { candidateId: "cand-2", matchScore: 70, confidence: 75 },
        { candidateId: "cand-3", matchScore: 60, confidence: 95 },
      ],
    });

    const result = await runShortlist({ jobId: "job-1" }, {}, guardrails);

    expect(result.shortlistedCandidates.map((entry) => entry.candidateId)).toEqual(["cand-1", "cand-2"]);
    expect(result.strategy).toBe("quality");
    expect(mockSetShortlistState).toHaveBeenCalledWith("job-1", "cand-3", false, undefined, expect.any(Object));
  });

  it("forces strict strategy during fire drill", async () => {
    mockLoadTenantMode.mockResolvedValue({
      mode: "fire_drill",
      guardrailsPreset: "conservative",
      agentsEnabled: [],
      source: "database",
    });

    mockJobFindUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      matches: [
        { candidateId: "cand-1", matchScore: 85, confidence: 90 },
        { candidateId: "cand-2", matchScore: 90, confidence: 60 },
      ],
    });

    const result = await runShortlist({ jobId: "job-1" }, {}, guardrails);

    expect(result.shortlistedCandidates.map((entry) => entry.candidateId)).toEqual(["cand-1"]);
    expect(result.strategy).toBe("strict");
    expect(mockSetShortlistState).toHaveBeenCalledWith("job-1", "cand-2", false, undefined, expect.any(Object));
  });
});
