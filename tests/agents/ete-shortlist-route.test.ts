import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as shortlistPost } from "@/app/api/ete/agents/shortlist/route";
import { guardrailsPresets } from "@/lib/guardrails/presets";
import { makeNextRequest, prisma, resetDbMocks } from "@tests/helpers";

const { mockRequireRole, mockGetAgentAvailability, mockEnforceKillSwitch, mockLoadTenantConfig, mockJobFindUnique } =
  vi.hoisted(() => {
    return {
      mockRequireRole: vi.fn(async () => ({ ok: true, user: { id: "user-1", tenantId: "tenant-1" } })),
      mockGetAgentAvailability: vi.fn(),
      mockEnforceKillSwitch: vi.fn(async () => null),
      mockLoadTenantConfig: vi.fn(async () => guardrailsPresets.balanced),
      mockJobFindUnique: vi.fn(),
    };
  });
vi.mock("@/lib/auth/requireRole", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/agents/agentAvailability", () => ({ getAgentAvailability: mockGetAgentAvailability }));
vi.mock("@/lib/agents/killSwitch", () => ({
  AGENT_KILL_SWITCHES: { RANKER: "ETE-TS.RANKER" },
  enforceAgentKillSwitch: mockEnforceKillSwitch,
}));
vi.mock("@/lib/guardrails/tenantConfig", () => ({ loadTenantConfig: mockLoadTenantConfig }));

const buildRequest = (body: unknown) =>
  makeNextRequest({
    method: "POST",
    url: "http://localhost/api/ete/agents/shortlist",
    json: body,
  });

describe("ETE SHORTLIST agent endpoint", () => {
  beforeEach(() => {
    resetDbMocks();
    prisma.job.findUnique.mockImplementation(mockJobFindUnique);
    vi.clearAllMocks();
  });

  it("returns shortlist results using confidence when available", async () => {
    mockGetAgentAvailability.mockResolvedValue({
      isEnabled: (name: string) => name !== "EXPLAIN",
      mode: { mode: "pilot", guardrailsPreset: "balanced", agentsEnabled: ["SHORTLIST", "CONFIDENCE"] },
      flags: [],
    });
    mockLoadTenantConfig.mockResolvedValue(guardrailsPresets.balanced);
    mockJobFindUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      matches: [
        { candidateId: "cand-1", matchScore: 92, confidence: 85 },
        { candidateId: "cand-2", matchScore: 88, confidence: 70 },
        { candidateId: "cand-3", matchScore: 40, confidence: 10 },
      ],
    });

    const response = await shortlistPost(buildRequest({ jobId: "job-1" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      jobId: "job-1",
      strategy: "quality",
      shortlistedCandidateIds: ["cand-1", "cand-2"],
      cutoffScore: 88,
      notes: [],
    });
  });

  it("falls back to match scores when confidence is disabled and enforces fire drill strategy", async () => {
    mockGetAgentAvailability.mockResolvedValue({
      isEnabled: (name: string) => name !== "CONFIDENCE" || name === "SHORTLIST",
      mode: { mode: "fire_drill", guardrailsPreset: "conservative", agentsEnabled: ["SHORTLIST"] },
      flags: [],
    });
    mockLoadTenantConfig.mockResolvedValue(guardrailsPresets.aggressive);
    mockJobFindUnique.mockResolvedValue({
      id: "job-2",
      tenantId: "tenant-1",
      matches: [
        { candidateId: "cand-1", matchScore: 80, confidence: null },
        { candidateId: "cand-2", matchScore: 60, confidence: null },
      ],
    });

    const response = await shortlistPost(buildRequest({ jobId: "job-2" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.strategy).toBe("strict");
    expect(payload.shortlistedCandidateIds).toEqual(["cand-1"]);
    expect(payload.cutoffScore).toBe(80);
    expect(payload.notes).toEqual([
      "Confidence unavailable; using match score only.",
      "Fire Drill mode active: using strict shortlist strategy and conservative thresholds.",
    ]);
  });
});
