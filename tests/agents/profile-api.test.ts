import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as profilePost } from "@/app/api/agents/profile/route";
import { makeRequest } from "@tests/test-utils/routeHarness";

const { mockCallLLM, mockCandidateCreate, mockWithAgentRun, createdSkills } = vi.hoisted(() => {
  const createdSkills: Array<{ candidateId: string; name: string } & Record<string, unknown>> = [];

  const mockCallLLM = vi.fn();
  const mockCandidateCreate = vi.fn(async ({ data }) => {
    const candidateId = "candidate-123";
    const skills = Array.isArray(data.skills?.create) ? data.skills.create : [];

    createdSkills.splice(
      0,
      createdSkills.length,
      ...skills.map((skill) => ({ ...skill, candidateId })),
    );

    return { id: candidateId, ...data };
  });
  const mockWithAgentRun = vi.fn(async (_input, fn: () => Promise<unknown>) => {
    const result = await fn();
    const payload = typeof result === "object" && result && "result" in (result as object)
      ? (result as { result: unknown }).result
      : result;

    return [payload, "agent-run-abc"] as const;
  });

  return { mockCallLLM, mockCandidateCreate, mockWithAgentRun, createdSkills };
});

vi.mock("@/server/db", () => ({
  prisma: {
    candidate: {
      create: mockCandidateCreate,
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    },
  },
}));

vi.mock("@/lib/agents/agentRun", () => ({ withAgentRun: mockWithAgentRun }));
vi.mock("@/lib/agents/promptRegistry", () => ({
  AGENT_PROMPTS: { RINA_SYSTEM: "RINA_SYSTEM" },
  resolveAgentPrompt: vi.fn().mockResolvedValue({ prompt: "prompt", version: "v1" }),
}));
vi.mock("@/lib/agents/killSwitch", () => ({
  AGENT_KILL_SWITCHES: { RINA: "ETE-TS.RINA" },
  enforceAgentKillSwitch: vi.fn(),
  assertAgentKillSwitchDisarmed: vi.fn(),
}));
vi.mock("@/lib/featureFlags/middleware", () => ({ agentFeatureGuard: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/subscription/usageLimits", () => ({ assertTenantWithinLimits: vi.fn() }));
vi.mock("@/lib/llm", () => ({ callLLM: mockCallLLM }));
const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn().mockResolvedValue({
    id: "user-42",
    tenantId: "tenant-1",
    role: "RECRUITER",
  }),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-1"),
  withTenantContext: async (_tenantId: string, callback: () => Promise<unknown>) => callback(),
}));
vi.mock("@/lib/killSwitch", () => ({
  assertKillSwitchDisarmed: vi.fn(),
  KILL_SWITCHES: { AGENTS: "AGENTS" },
}));
vi.mock("@/app/api/agents/recruiterValidation", () => ({
  validateRecruiterId: vi.fn().mockResolvedValue({ recruiterId: "user-42" }),
}));
vi.mock("@/lib/rateLimiting/rateLimiter", () => ({ isRateLimitError: () => false }));
vi.mock("@/lib/rateLimiting/http", () => ({ toRateLimitResponse: vi.fn() }));

const llmResponse = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  phone: null,
  location: "Remote",
  currentTitle: "Engineer",
  currentCompany: "TechCorp",
  totalExperienceYears: 5,
  seniorityLevel: "Mid",
  summary: "Skilled engineer",
  skills: [
    { name: "TypeScript", normalizedName: "typescript", proficiency: "high", yearsOfExperience: 4 },
    { name: "React", normalizedName: "react", proficiency: null, yearsOfExperience: null },
  ],
  parsingConfidence: 0.8,
  warnings: [],
};

describe("PROFILE agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdSkills.splice(0, createdSkills.length);
  });

  it("persists candidates and skills from mocked LLM output", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(llmResponse));

    const request = makeRequest({
      method: "POST",
      url: "http://localhost/api/agents/profile",
      json: { rawResumeText: "Jane's resume", sourceType: "upload", sourceTag: "career-site" },
    });

    const response = await profilePost(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ candidateId: "candidate-123", agentRunId: "agent-run-abc" });
    expect(mockWithAgentRun).toHaveBeenCalled();
    expect(mockCandidateCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCandidateCreate.mock.calls[0]?.[0];
    expect(createCall?.data.fullName).toBe(llmResponse.fullName);
    expect(createCall?.data.skills.create).toHaveLength(2);

    expect(createdSkills.map((skill) => ({ name: skill.name, candidateId: skill.candidateId })) ).toEqual([
      { name: "TypeScript", candidateId: "candidate-123" },
      { name: "React", candidateId: "candidate-123" },
    ]);
  });

  it("returns 403 for unauthorized roles", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "user-42",
      tenantId: "tenant-1",
      role: "SALES",
    });

    const request = makeRequest({
      method: "POST",
      url: "http://localhost/api/agents/profile",
      json: { rawResumeText: "text", sourceType: "upload" },
    });

    const response = await profilePost(request);

    expect(response.status).toBe(403);
  });
});
