import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as confidencePost } from "@/app/api/jobs/[jobId]/confidence/route";
import { runConfidence } from "@/lib/agents/confidence";

vi.mock("@/lib/agents/confidence", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/confidence")>(
    "@/lib/agents/confidence",
  );

  return {
    ...actual,
    runConfidence: vi.fn(),
  };
});

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(async () => ({ ok: true, user: { id: "user-1", role: "RECRUITER" } })),
}));

vi.mock("@/lib/auth/requireRole", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/auth/roles", () => ({ USER_ROLES: { ADMIN: "ADMIN", RECRUITER: "RECRUITER" } }));

const requestBody = { recruiterId: "recruiter-1" };

const context = { params: Promise.resolve({ jobId: "job-123" }) } as const;

describe("CONFIDENCE agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const runConfidenceMock = runConfidence as unknown as vi.Mock;
    runConfidenceMock.mockResolvedValue({
      jobId: "job-123",
      recomputed: [{ candidateId: "cand-1", confidence: 97 }],
    });
  });

  it("enforces RBAC", async () => {
    mockRequireRole.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 401 }) });

    const response = await confidencePost(
      new NextRequest(
        new Request("http://localhost/api/jobs/job-123/confidence", {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: { "content-type": "application/json" },
        }),
      ),
      context,
    );

    expect(response.status).toBe(401);
    expect(runConfidence).not.toHaveBeenCalled();
  });

  it("passes tenant context to the confidence agent and returns results", async () => {
    const req = new NextRequest(
      new Request("http://localhost/api/jobs/job-123/confidence", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await confidencePost(req, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runConfidence).toHaveBeenCalledWith({ jobId: "job-123", recruiterId: "recruiter-1" }, req);
    expect(body).toEqual({ jobId: "job-123", recomputed: [{ candidateId: "cand-1", confidence: 97 }] });
  });
});
