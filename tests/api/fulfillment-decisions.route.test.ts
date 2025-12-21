import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as listDecisions } from "@/app/api/fulfillment/decisions/route";
import { makeNextRequest, readJson } from "@tests/helpers";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listDecisionArtifacts: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/server/decision/decisionArtifacts", () => ({
  listDecisionArtifacts: mocks.listDecisionArtifacts,
}));

describe("fulfillment decisions API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      email: "ops@example.com",
      displayName: "Ops User",
      role: "RECRUITER",
    });
    mocks.listDecisionArtifacts.mockResolvedValue([
      {
        id: "dec-1",
        status: "PUBLISHED",
        type: "RECOMMENDATION",
        jobId: "job-1",
        candidateIds: ["cand-1"],
        payload: { summary: "Submitted to hiring manager" },
        createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
        updatedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
        publishedAt: new Date("2024-01-02T00:00:00Z").toISOString(),
        createdByUserId: "user-1",
        tenantId: "tenant-1",
      },
    ]);
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);

    const response = await listDecisions(makeNextRequest({ url: "http://localhost/api/fulfillment/decisions" }));

    expect(response.status).toBe(401);
    expect(mocks.listDecisionArtifacts).not.toHaveBeenCalled();
  });

  it("returns decisions for the current tenant and forwards filters", async () => {
    const response = await listDecisions(
      makeNextRequest({
        url: "http://localhost/api/fulfillment/decisions",
        query: { jobId: "job-1" },
      }),
    );
    const body = await readJson<{ artifacts: unknown[] }>(response);

    expect(response.status).toBe(200);
    expect(body.artifacts).toHaveLength(1);
    expect(mocks.listDecisionArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        filters: { jobId: "job-1", candidateId: undefined },
      }),
    );
  });
});
