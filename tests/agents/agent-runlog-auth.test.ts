import { describe, expect, it, vi, beforeEach } from "vitest";

import { POST as rinaPost } from "@/app/api/agents/rina/route";
import { mockDb } from "@/test-helpers/db";
import { makeRequest } from "@tests/test-utils/routeHarness";

const {
  mockAgentRunLogCreate,
  mockAgentRunLogUpdate,
  mockCandidateCreate,
  mockUserFindUnique,
} = vi.hoisted(() => {
  const mockAgentRunLogCreate = vi.fn(async (_client, data) => ({ id: "run-123", ...data }));
  const mockAgentRunLogUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
  const mockCandidateCreate = vi.fn(async ({ data }) => ({ id: "cand-123", ...data }));
  const mockUserFindUnique = vi.fn(async ({ where }) => ({ id: where?.id ?? "test-user-1", tenantId: "tenant-1" }));

  return {
    mockAgentRunLogCreate,
    mockAgentRunLogUpdate,
    mockCandidateCreate,
    mockUserFindUnique,
  };
});

const { mockCallLLM } = vi.hoisted(() => ({
  mockCallLLM: vi.fn().mockResolvedValue(
    JSON.stringify({
      fullName: "Test User",
      email: "candidate@example.com",
      phone: "123-456-7890",
      location: "Earth",
      currentTitle: "Engineer",
      currentCompany: "Example Corp",
      totalExperienceYears: 5,
      seniorityLevel: "MID",
      summary: "A skilled engineer.",
      parsingConfidence: 0.9,
      warnings: [],
      skills: [{
        name: "TypeScript",
        normalizedName: "typescript",
        proficiency: "EXPERT",
        yearsOfExperience: 3,
      }],
    }),
  ),
}));

const { prisma, resetDbMocks } = mockDb();

vi.mock("@/lib/agents/tenantScope", () => ({
  getTenantScopedPrismaClient: vi.fn(async () => ({
    prisma: prisma as any,
    tenantId: "tenant-1",
    runWithTenantContext: async <T>(callback: () => Promise<T>) => callback(),
  })),
  toTenantErrorResponse: () => null,
}));

vi.mock("@/lib/auth/requireRole", () => ({
  requireRole: vi.fn(async () => ({ ok: true, user: { id: "test-user-1", tenantId: "tenant-1" } })),
}));

vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS" },
}));

vi.mock("@/lib/agents/killSwitch", () => ({
  assertAgentKillSwitchDisarmed: vi.fn(),
  AGENT_KILL_SWITCHES: { RINA: "ETE-TS.RINA" },
  enforceAgentKillSwitch: vi.fn(),
}));

vi.mock("@/lib/featureFlags/middleware", () => ({
  agentFeatureGuard: vi.fn().mockResolvedValue(null),
  enforceFeatureFlag: vi.fn().mockResolvedValue(null),
  assertFeatureEnabled: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/subscription/usageLimits", () => ({
  assertTenantWithinLimits: vi.fn(),
}));

vi.mock("@/lib/agents/promptRegistry", () => ({
  AGENT_PROMPTS: { RINA_SYSTEM: "RINA_SYSTEM" },
  resolveAgentPrompt: vi.fn().mockResolvedValue({ prompt: "test-prompt", version: "v1" }),
}));

vi.mock("@/lib/llm", () => ({ callLLM: mockCallLLM }));

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn().mockResolvedValue({
    id: "test-user-1",
    tenantId: "tenant-1",
    email: "test@example.com",
    role: "recruiter",
  }),
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mockGetCurrentUser }));

describe("Agent run logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    prisma.agentRunLog.create.mockImplementation(mockAgentRunLogCreate);
    prisma.agentRunLog.update.mockImplementation(mockAgentRunLogUpdate);
    prisma.candidate.create.mockImplementation(mockCandidateCreate);
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1" });
    prisma.user.findUnique.mockImplementation(mockUserFindUnique);
    mockCallLLM.mockClear();
    mockGetCurrentUser.mockClear();
    mockCallLLM.mockResolvedValue(
      JSON.stringify({
        fullName: "Test User",
        email: "candidate@example.com",
        phone: "123-456-7890",
        location: "Earth",
        currentTitle: "Engineer",
        currentCompany: "Example Corp",
        totalExperienceYears: 5,
        seniorityLevel: "MID",
        summary: "A skilled engineer.",
        parsingConfidence: 0.9,
        warnings: [],
        skills: [{
          name: "TypeScript",
          normalizedName: "typescript",
          proficiency: "EXPERT",
          yearsOfExperience: 3,
        }],
      }),
    );
    mockGetCurrentUser.mockResolvedValue({
      id: "test-user-1",
      tenantId: "tenant-1",
      email: "test@example.com",
      role: "recruiter",
    });
  });

  it("records the current user on RINA agent runs", async () => {
    const requestBody = {
      rawResumeText: "Sample resume text",
      sourceType: "upload",
      sourceTag: "test-tag",
    };

    const request = makeRequest({
      method: "POST",
      url: "http://localhost/api/agents/rina",
      json: requestBody,
    });

    const response = await rinaPost(request);

    expect(response.status).toBe(200);
    expect(mockAgentRunLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentName: "ETE-TS.RINA", tenantId: "tenant-1", userId: "test-user-1" }),
      }),
    );
  });
});
