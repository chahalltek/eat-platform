import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as publishDecision } from "@/app/api/decisions/[decisionId]/publish/route";
import { POST } from "@/app/api/decisions/route";
import { makeNextRequest, readJson } from "@tests/helpers";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  canCreateDecisionDraft: vi.fn(),
  canPublishDecision: vi.fn(),
  canViewCandidates: vi.fn(),
  listDecisionsForJob: vi.fn(),
  createDecisionDraft: vi.fn(),
  publishDecisionDraft: vi.fn(),
  getDecisionById: vi.fn(),
  findJob: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/auth/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/permissions")>("@/lib/auth/permissions");
  return {
    ...actual,
    canCreateDecisionDraft: mocks.canCreateDecisionDraft,
    canPublishDecision: mocks.canPublishDecision,
    canViewCandidates: mocks.canViewCandidates,
  };
});
vi.mock("@/server/decision/decisionDrafts", async () => {
  const actual = await vi.importActual<typeof import("@/server/decision/decisionDrafts")>("@/server/decision/decisionDrafts");

  return {
    ...actual,
    listDecisionsForJob: mocks.listDecisionsForJob,
    createDecisionDraft: mocks.createDecisionDraft,
    publishDecisionDraft: mocks.publishDecisionDraft,
    getDecisionById: mocks.getDecisionById,
    toDecisionDto: (decision: any) => decision,
  };
});
vi.mock("@/server/db/prisma", () => ({
  prisma: {
    jobReq: { findUnique: mocks.findJob },
  },
  DecisionStatus: { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED" },
}));

const baseDecision = {
  id: "dec-1",
  jobReqId: "job-1",
  tenantId: "tenant-1",
  status: "DRAFT",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  publishedAt: null,
  candidateIds: [],
  payload: {
    job: { id: "job-1", title: "Demo", location: null, summary: null, intentSummary: null },
    shortlist: [],
    agentOutputs: { shortlistDigest: [], intentSummary: null },
    rationale: { decision: "", risks: [], nextSteps: "" },
  },
};

describe("decision routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "demo@example.com",
      displayName: "Demo User",
      role: "RECRUITER",
      tenantId: "tenant-1",
    });
    mocks.findJob.mockResolvedValue({ id: "job-1", tenantId: "tenant-1" });
    mocks.canCreateDecisionDraft.mockReturnValue(true);
    mocks.canPublishDecision.mockReturnValue(true);
    mocks.canViewCandidates.mockReturnValue(true);
    mocks.listDecisionsForJob.mockResolvedValue([baseDecision]);
    mocks.createDecisionDraft.mockResolvedValue(baseDecision);
    mocks.getDecisionById.mockResolvedValue(baseDecision);
    mocks.publishDecisionDraft.mockResolvedValue({ ...baseDecision, status: "PUBLISHED", publishedAt: baseDecision.createdAt });
  });

  it("rejects draft creation when the user lacks permission", async () => {
    mocks.canCreateDecisionDraft.mockReturnValue(false);

    const response = await POST(
      makeNextRequest({
        method: "POST",
        url: "http://localhost/api/decisions",
        json: { jobId: "job-1" },
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createDecisionDraft).not.toHaveBeenCalled();
  });

  it("publishes a decision for recruiters", async () => {
    const response = await publishDecision(
      makeNextRequest({ method: "POST", url: "http://localhost/api/decisions/dec-1/publish" }),
      { params: { decisionId: "dec-1" } },
    );

    expect(response.status).toBe(200);
    const body = await readJson<{ decision: { status: string } }>(response);
    expect(body.decision.status).toBe("PUBLISHED");
    expect(mocks.publishDecisionDraft).toHaveBeenCalledWith("dec-1", "user-1");
  });

  it("returns 403 for publish attempts without permission", async () => {
    mocks.canPublishDecision.mockReturnValue(false);

    const response = await publishDecision(
      makeNextRequest({ method: "POST", url: "http://localhost/api/decisions/dec-1/publish" }),
      { params: { decisionId: "dec-1" } },
    );

    expect(response.status).toBe(403);
  });
});
