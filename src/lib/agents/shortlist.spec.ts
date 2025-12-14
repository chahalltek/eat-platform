import { beforeEach, describe, expect, it, vi } from "vitest";

import { runShortlist } from "@/lib/agents/shortlist";
import { enableDeterministicAgentMode } from "./testing/deterministicAgentMode";
import { guardrailsPresets } from "@/lib/guardrails/presets";

const shortlistFixtures = vi.hoisted(() =>
  require("../../../tests/fixtures/agents/shortlist-quality.json") as {
    job: unknown;
    fireDrillJob: unknown;
  },
);

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

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    job: { findUnique: (...args: unknown[]) => mockJobFindUnique(...args) },
    $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn({}),
  },
}));

describe("runShortlist", () => {
  let deterministic: ReturnType<typeof enableDeterministicAgentMode>;
  const guardrails = {
    ...guardrailsPresets.balanced,
    shortlist: { strategy: "quality", maxCandidates: 2 },
  } as const;

  beforeAll(() => {
    deterministic = enableDeterministicAgentMode();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadTenantMode.mockResolvedValue({
      mode: "production",
      guardrailsPreset: "balanced",
      agentsEnabled: [],
      source: "database",
    });
  });

  afterAll(() => {
    deterministic.restore();
  });

  it("uses quality strategy ordering and thresholds", async () => {
    mockJobFindUnique.mockResolvedValue(shortlistFixtures.job);

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

    mockJobFindUnique.mockResolvedValue(shortlistFixtures.fireDrillJob);

    const result = await runShortlist({ jobId: "job-1" }, {}, guardrails);

    expect(result.shortlistedCandidates.map((entry) => entry.candidateId)).toEqual(["cand-1"]);
    expect(result.strategy).toBe("strict");
    expect(mockSetShortlistState).toHaveBeenCalledWith("job-1", "cand-2", false, undefined, expect.any(Object));
  });
});
