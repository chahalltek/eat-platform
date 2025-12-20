import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/decision-receipts/route";

const mocks = vi.hoisted(() => ({
  requireRecruiterOrAdmin: vi.fn(),
  createDecisionReceipt: vi.fn(),
  listDecisionReceipts: vi.fn(),
}));

vi.mock("@/lib/auth/requireRole", () => ({ requireRecruiterOrAdmin: mocks.requireRecruiterOrAdmin }));
vi.mock("@/server/decision/decisionReceipts", async () => {
  const actual = await vi.importActual<typeof import("@/server/decision/decisionReceipts")>("@/server/decision/decisionReceipts");

  return {
    ...actual,
    createDecisionReceipt: mocks.createDecisionReceipt,
    listDecisionReceipts: mocks.listDecisionReceipts,
  };
});

describe("decision receipt routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireRecruiterOrAdmin.mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "demo@example.com", displayName: "Demo User", tenantId: "tenant-1", role: "RECRUITER" },
    });
    mocks.createDecisionReceipt.mockResolvedValue({
      id: "rec-1",
      jobId: "job-1",
      candidateId: "cand-1",
      candidateName: "Jane Doe",
      decisionType: "RECOMMEND",
      drivers: ["Great fit"],
      tradeoff: "Balanced",
      confidenceScore: 8.5,
      risks: ["Limited client experience"],
      summary: "Recommendation recorded.",
      createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
      createdBy: { id: "user-1", email: "demo@example.com", name: "Demo User" },
      bullhornNote: "Recommendation recorded. Synced as note for auditability.",
      bullhornTarget: "note",
    });
    mocks.listDecisionReceipts.mockResolvedValue([]);
  });

  it("creates a decision receipt with POST", async () => {
    const request = new Request("http://localhost/api/decision-receipts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId: "job-1",
        candidateId: "cand-1",
        candidateName: "Jane Doe",
        decisionType: "RECOMMEND",
        drivers: ["Great fit"],
        risks: ["Coverage gap"],
        confidenceScore: 8.5,
        summary: "Recommendation recorded.",
        bullhornTarget: "note",
      }),
    });

    const response = await POST(new NextRequest(request));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.receipt.id).toBe("rec-1");
    expect(mocks.createDecisionReceipt).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      payload: expect.objectContaining({ decisionType: "RECOMMEND", jobId: "job-1", candidateId: "cand-1" }),
      user: expect.objectContaining({ id: "user-1" }),
    });
  });

  it("rejects invalid receipt payloads", async () => {
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/decision-receipts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ candidateId: "cand-1", decisionType: "RECOMMEND" }),
        }),
      ),
    );

    expect(response.status).toBe(400);
  });

  it("lists receipts for a job", async () => {
    mocks.listDecisionReceipts.mockResolvedValue([
      {
        id: "rec-1",
        jobId: "job-1",
        candidateId: "cand-1",
        candidateName: "Jane Doe",
        decisionType: "RECOMMEND",
        drivers: ["Great fit"],
        tradeoff: "Balanced",
        confidenceScore: 8.5,
        risks: ["Limited client experience"],
        summary: "Recommendation recorded.",
        createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
        createdBy: { id: "user-1", email: "demo@example.com", name: "Demo User" },
        bullhornNote: "Recommendation recorded. Synced as note for auditability.",
        bullhornTarget: "note",
      },
    ]);

    const response = await GET(new NextRequest(new Request("http://localhost/api/decision-receipts?jobId=job-1")));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.receipts).toHaveLength(1);
    expect(mocks.listDecisionReceipts).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      jobId: "job-1",
      candidateId: null,
    });
  });

  it("requires jobId when fetching receipts", async () => {
    const response = await GET(new NextRequest(new Request("http://localhost/api/decision-receipts")));
    expect(response.status).toBe(400);
  });
});
