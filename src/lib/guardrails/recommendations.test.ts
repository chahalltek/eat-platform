/// <reference types="vitest/globals" />

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    matchQualitySnapshot: { findMany: vi.fn(async () => []) },
    matchFeedback: { findMany: vi.fn(async () => []) },
  },
  isPrismaUnavailableError: () => false,
  isTableAvailable: vi.fn(async () => true),
}));

vi.mock("@/lib/tenant/guardrails", () => ({
  loadTenantGuardrails: vi.fn(async () => ({
    scoring: {
      thresholds: { minMatchScore: 55, shortlistMinScore: 65, shortlistMaxCandidates: 8 },
      strategy: "weighted",
      weights: { mustHaveSkills: 40, niceToHaveSkills: 20, experience: 25, location: 15 },
    },
    explain: { level: "compact", includeWeights: true },
    safety: { requireMustHaves: true, excludeInternalCandidates: false, confidenceBands: { high: 0.75, medium: 0.55 } },
    llm: { provider: "openai", model: "gpt-4.1-mini", allowedAgents: ["EXPLAIN"], maxTokens: 600, verbosityCap: 2000 },
    networkLearning: { enabled: false },
  })),
}));

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: vi.fn(async () => ({ mode: "production", guardrailsPreset: "balanced", agentsEnabled: [], source: "database" })),
}));

import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { guardrailRecommendationEngine, GuardrailRecommendationEngine } from "./recommendations";

describe("GuardrailRecommendationEngine", () => {
  let prisma: Awaited<ReturnType<typeof importModule>>;

  async function importModule() {
    return import("@/server/db/prisma");
  }

  beforeAll(async () => {
    prisma = await importModule();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suggests guardrail tightening when MQI drops and false positives climb", async () => {
    vi.mocked(prisma.prisma.matchQualitySnapshot.findMany).mockResolvedValueOnce([
      { mqi: 60 },
      { mqi: 68 },
    ] as never);

    vi.mocked(prisma.prisma.matchFeedback.findMany).mockResolvedValueOnce([
      { direction: "DOWN", matchScore: 52, confidenceScore: 48 },
      { direction: "DOWN", matchScore: 55, confidenceScore: 50 },
      { direction: "DOWN", matchScore: 57, confidenceScore: 52 },
      { direction: "UP", matchScore: 58, confidenceScore: 62 },
      { direction: "UP", matchScore: 59, confidenceScore: 65 },
      { direction: "UP", matchScore: 54, confidenceScore: 66 },
      { direction: "UP", matchScore: 57, confidenceScore: 68 },
      { direction: "UP", matchScore: 55, confidenceScore: 64 },
    ] as never);

    const recommendations = await guardrailRecommendationEngine.generate("tenant-1");
    const ids = recommendations.map((entry) => entry.id);

    expect(ids).toContain("increase-min-match-score");
    expect(ids).toContain("reduce-shortlist-width");
    expect(ids).toContain("raise-confidence-bands");
    const summary = recommendations.find((rec) => rec.id === "increase-min-match-score")?.suggestedChange;
    expect(summary).toContain("minMatchScore");
    expect(recommendations.every((rec) => rec.systemMode === "production")).toBe(true);
    expect(recommendations.every((rec) => rec.generatedAt instanceof Date)).toBe(true);
  });

  it("persists manual review decisions across recomputes", async () => {
    const engine = new GuardrailRecommendationEngine();
    vi.mocked(prisma.prisma.matchQualitySnapshot.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.prisma.matchFeedback.findMany).mockResolvedValue([] as never);

    const first = await engine.generate("tenant-2");
    expect(first[0].id).toBe("no-action");

    await engine.updateStatus("tenant-2", first[0].id, "dismissed");

    const second = await engine.generate("tenant-2");
    expect(second[0].status).toBe("dismissed");
  });

  it("forces low-confidence recommendations in pilot mode", async () => {
    loadTenantMode.mockResolvedValueOnce({ mode: "pilot", guardrailsPreset: "conservative", agentsEnabled: [], source: "database" });
    vi.mocked(prisma.prisma.matchQualitySnapshot.findMany).mockResolvedValueOnce([
      { mqi: 60 },
      { mqi: 68 },
    ] as never);
    vi.mocked(prisma.prisma.matchFeedback.findMany).mockResolvedValueOnce([
      { direction: "UP", matchScore: 70, confidenceScore: 82 },
    ] as never);

    const recommendations = await guardrailRecommendationEngine.generate("tenant-3");

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((rec) => rec.confidence === "low")).toBe(true);
    expect(recommendations.every((rec) => rec.systemMode === "pilot")).toBe(true);
  });

  it("returns no learning output in fire drill mode", async () => {
    loadTenantMode.mockResolvedValueOnce({ mode: "fire_drill", guardrailsPreset: "conservative", agentsEnabled: [], source: "database" });

    const recommendations = await guardrailRecommendationEngine.generate("tenant-4");

    expect(recommendations).toEqual([]);
  });
});

