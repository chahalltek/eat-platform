import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as publishDecision } from "@/app/api/fulfillment/decisions/[id]/publish/route";
import { GET as listDecisions, POST as createDecision } from "@/app/api/fulfillment/decisions/route";
import { makeNextRequest, readJson } from "@tests/helpers";

const now = new Date("2024-01-01T00:00:00Z");

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createArtifact: vi.fn(),
  findManyArtifacts: vi.fn(),
  updateArtifact: vi.fn(),
  findFirstArtifact: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/server/db/prisma", () => ({
  DecisionArtifactStatus: { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED" },
  prisma: {
    decisionArtifact: {
      create: mocks.createArtifact,
      findMany: mocks.findManyArtifacts,
      update: mocks.updateArtifact,
      findFirst: mocks.findFirstArtifact,
    },
  },
}));

describe("fulfillment decision artifact routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "demo@example.com",
      displayName: "Demo User",
      role: "RECRUITER",
      tenantId: "tenant-1",
    });

    mocks.createArtifact.mockResolvedValue({
      id: "art-1",
      jobReqId: "job-1",
      candidateId: "cand-1",
      payload: { summary: "draft" },
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      createdBy: "user-1",
      tenantId: "tenant-1",
    });

    mocks.findManyArtifacts.mockResolvedValue([]);
    mocks.findFirstArtifact.mockResolvedValue({
      id: "art-1",
      jobReqId: "job-1",
      candidateId: "cand-1",
      payload: { summary: "draft" },
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      createdBy: "user-1",
      tenantId: "tenant-1",
    });

    mocks.updateArtifact.mockResolvedValue({
      id: "art-1",
      jobReqId: "job-1",
      candidateId: "cand-1",
      payload: { summary: "draft" },
      status: "PUBLISHED",
      createdAt: now,
      updatedAt: now,
      publishedAt: new Date("2024-01-02T00:00:00Z"),
      createdBy: "user-1",
      tenantId: "tenant-1",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const request = makeNextRequest({ method: "GET", url: "http://localhost/api/fulfillment/decisions" });
    const response = await listDecisions(request);

    expect(response.status).toBe(401);
  });

  it("allows a sourcer to create a draft artifact", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-2",
      email: "sourcer@example.com",
      displayName: "Sourcer User",
      role: "SOURCER",
      tenantId: "tenant-1",
    });

    const request = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/fulfillment/decisions",
      json: { jobId: "job-1", candidateId: "cand-1", payload: { summary: "draft" } },
    });

    const response = await createDecision(request);
    const body = await readJson<{ artifact: { status: string } }>(response);

    expect(response.status).toBe(201);
    expect(body.artifact.status).toBe("DRAFT");
    expect(mocks.createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobReqId: "job-1", candidateId: "cand-1", status: "DRAFT" }),
      }),
    );
  });

  it("blocks publish for sourcers", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-2",
      email: "sourcer@example.com",
      displayName: "Sourcer User",
      role: "SOURCER",
      tenantId: "tenant-1",
    });

    const request = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/fulfillment/decisions/art-1/publish",
    });

    const response = await publishDecision(request, { params: Promise.resolve({ id: "art-1" }) });

    expect(response.status).toBe(403);
  });

  it("allows recruiters to publish and sets publishedAt", async () => {
    const request = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/fulfillment/decisions/art-1/publish",
    });

    const response = await publishDecision(request, { params: Promise.resolve({ id: "art-1" }) });
    const body = await readJson<{ artifact: { status: string; publishedAt: string | null } }>(response);

    expect(response.status).toBe(200);
    expect(body.artifact.status).toBe("PUBLISHED");
    expect(body.artifact.publishedAt).toBeTruthy();
  });

  it("lists artifacts scoped to the tenant", async () => {
    mocks.findManyArtifacts.mockResolvedValue([
      {
        id: "art-1",
        jobReqId: "job-1",
        candidateId: "cand-1",
        payload: { summary: "draft" },
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        createdBy: "user-1",
        tenantId: "tenant-1",
      },
    ]);

    const request = makeNextRequest({
      method: "GET",
      url: "http://localhost/api/fulfillment/decisions",
      query: { jobId: "job-1" },
    });

    const response = await listDecisions(request);
    const body = await readJson<{ artifacts: Array<{ jobId: string }> }>(response);

    expect(response.status).toBe(200);
    expect(body.artifacts).toHaveLength(1);
    expect(body.artifacts[0].jobId).toBe("job-1");
    expect(mocks.findManyArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1", jobReqId: "job-1" }),
      }),
    );
  });

  it("requires a jobId or candidateId when listing artifacts", async () => {
    const request = makeNextRequest({
      method: "GET",
      url: "http://localhost/api/fulfillment/decisions",
    });

    const response = await listDecisions(request);

    expect(response.status).toBe(400);
  });
});
