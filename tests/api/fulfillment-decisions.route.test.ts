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
      role: "ADMIN",
    });
    mocks.listDecisionArtifacts.mockResolvedValue([
      {
        id: "dec-1",
        status: "published",
        decisionType: "SUBMIT",
        jobId: "job-1",
        jobTitle: "Data Engineer",
        candidateId: "cand-1",
        candidateName: "Casey Candidate",
        summary: "Submitted to hiring manager",
        tradeoff: null,
        standardizedTradeoff: null,
        drivers: [],
        risks: [],
        standardizedRisks: [],
        createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
        createdBy: { id: "user-1", name: "Ops User", email: "ops@example.com" },
        visibility: "tenant",
      },
    ]);
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);

    const response = await listDecisions(makeNextRequest({ url: "http://localhost/api/fulfillment/decisions" }));

    expect(response.status).toBe(401);
    expect(mocks.listDecisionArtifacts).not.toHaveBeenCalled();
  });

  it("rejects invalid status filters", async () => {
    const response = await listDecisions(
      makeNextRequest({ url: "http://localhost/api/fulfillment/decisions?status=invalid" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid status" });
  });

  it("returns decisions for the current tenant and forwards filters", async () => {
    const response = await listDecisions(
      makeNextRequest({
        url: "http://localhost/api/fulfillment/decisions",
        query: { status: "draft", q: "casey", take: 800 },
      }),
    );
    const body = await readJson<{ decisions: unknown[] }>(response);

    expect(response.status).toBe(200);
    expect(body.decisions).toHaveLength(1);
    expect(mocks.listDecisionArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        status: "draft",
        search: "casey",
        take: 500,
      }),
    );
  });
});
