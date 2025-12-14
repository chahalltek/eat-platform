import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as retryPost } from "@/app/api/agents/runs/[id]/retry/route";
import { mockDb } from "@/test-helpers/db";
import { makeRequest } from "@tests/test-utils/routeHarness";

const {
  mockRunRina,
  mockRunRua,
  mockRunOutreach,
  mockGetCurrentUser,
  mockEnforceFeatureFlag,
  mockGetAgentFeatureName,
  mockFindFirst,
  mockCount,
} = vi.hoisted(() => ({
  mockRunRina: vi.fn(),
  mockRunRua: vi.fn(),
  mockRunOutreach: vi.fn(),
  mockGetCurrentUser: vi.fn().mockResolvedValue({ id: "user-1", tenantId: "tenant-1" }),
  mockEnforceFeatureFlag: vi.fn().mockResolvedValue(null),
  mockGetAgentFeatureName: vi.fn().mockReturnValue("RINA"),
  mockFindFirst: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock("@/lib/agents/rina", () => ({ runRina: mockRunRina }));
vi.mock("@/lib/agents/rua", () => ({ runRua: mockRunRua }));
vi.mock("@/lib/agents/outreach", () => ({ runOutreach: mockRunOutreach }));
vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/featureFlags/middleware", () => ({
  enforceFeatureFlag: mockEnforceFeatureFlag,
  getAgentFeatureName: mockGetAgentFeatureName,
}));
const { prisma, resetDbMocks } = mockDb();

const buildRequest = (runId: string) =>
  makeRequest({ method: "POST", url: `http://localhost/api/agents/runs/${runId}/retry` });

describe("agent retry API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetDbMocks();
    prisma.agentRunLog.findFirst.mockImplementation(mockFindFirst);
    prisma.agentRunLog.count.mockImplementation(mockCount);
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });
    mockEnforceFeatureFlag.mockResolvedValue(null);
    mockGetAgentFeatureName.mockReturnValue("RINA");
  });

  it("retries RINA runs when raw resume text is available", async () => {
    mockFindFirst.mockResolvedValue({
      id: "run-123",
      agentName: "ETE-TS.RINA",
      inputSnapshot: { rawResumeText: "resume text", sourceType: "upload", sourceTag: "career" },
      retryPayload: { rawResumeText: "resume text", sourceType: "upload", sourceTag: "career" },
      rawResumeText: "resume text",
      retryOfId: null,
    });
    mockCount.mockResolvedValue(0);
    mockRunRina.mockResolvedValue({ agentRunId: "new-run", candidateId: "candidate-1" });

    const response = await retryPost(buildRequest("run-123"), { params: Promise.resolve({ id: "run-123" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ agentRunId: "new-run", retryCount: 1 });
    expect(mockRunRina).toHaveBeenCalledWith(
      { rawResumeText: "resume text", sourceType: "upload", sourceTag: "career" },
      { retryOfId: "run-123", retryCount: 1 },
    );
    expect(mockCount).toHaveBeenCalledWith({ where: { retryOfId: "run-123", tenantId: "tenant-1" } });
  });

  it("returns a clear error when RINA retry input is missing", async () => {
    mockFindFirst.mockResolvedValue({
      id: "run-404",
      agentName: "ETE-TS.RINA",
      inputSnapshot: { sourceType: "upload" },
      retryPayload: null,
      rawResumeText: null,
      retryOfId: null,
    });
    mockCount.mockResolvedValue(2);

    const response = await retryPost(buildRequest("run-404"), { params: Promise.resolve({ id: "run-404" }) });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      errorCode: "MISSING_RETRY_INPUT",
      message: "This run cannot be retried because the original resume text is missing. New runs will store this data for retry.",
    });
    expect(mockRunRina).not.toHaveBeenCalled();
  });
});
