import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as shortlistPost } from "@/app/api/agents/shortlist/route";

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(async () => ({ ok: true, user: { id: "user-1", tenantId: "tenant-1" } })),
}));

const { mockSetShortlistState } = vi.hoisted(() => ({
  mockSetShortlistState: vi.fn(),
}));

vi.mock("@/lib/auth/requireRole", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/agents/shortlistState", () => ({ setShortlistState: mockSetShortlistState }));

const requestBody = { matchId: "match-1", shortlisted: true, reason: "Great fit" };

describe("SHORTLIST agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetShortlistState.mockResolvedValue({
      id: "match-1",
      shortlisted: true,
      shortlistReason: "Great fit",
      candidateId: "candidate-1",
      jobReqId: "job-1",
    });
  });

  it("enforces RBAC", async () => {
    mockRequireRole.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 403 }) });

    const response = await shortlistPost(
      new NextRequest(
        new Request("http://localhost/api/agents/shortlist", {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(response.status).toBe(403);
    expect(mockSetShortlistState).not.toHaveBeenCalled();
  });

  it("returns shortlist state for valid inputs", async () => {
    const response = await shortlistPost(
      new NextRequest(
        new Request("http://localhost/api/agents/shortlist", {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSetShortlistState).toHaveBeenCalledWith(requestBody, expect.any(NextRequest));
    expect(body).toEqual({
      id: "match-1",
      shortlisted: true,
      shortlistReason: "Great fit",
      candidateId: "candidate-1",
      jobReqId: "job-1",
    });
  });

  it("normalizes forbidden errors from tenant mismatch", async () => {
    mockSetShortlistState.mockRejectedValueOnce(new Error("Forbidden"));

    const response = await shortlistPost(
      new NextRequest(
        new Request("http://localhost/api/agents/shortlist", {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });
});
