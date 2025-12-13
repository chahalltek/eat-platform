import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockComputeMatchScore = vi.hoisted(() => vi.fn());
const mockComputeMatchConfidence = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/matching/msa", () => ({
  computeMatchScore: mockComputeMatchScore,
}));

vi.mock("@/lib/matching/confidence", () => ({
  computeMatchConfidence: mockComputeMatchConfidence,
}));

import { POST } from "./route";

describe("POST /api/admin/testing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeMatchScore.mockReturnValue({ score: 0, breakdown: [] });
    mockComputeMatchConfidence.mockReturnValue({ score: 0, factors: [] });
  });

  const buildRequest = (body: unknown = {}) =>
    makeRequest({ method: "POST", url: "http://localhost/api/admin/testing", json: body });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
    expect(mockComputeMatchScore).not.toHaveBeenCalled();
  });

  it("blocks non-admin users", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "RECRUITER" });

    const response = await POST(buildRequest({ scoring: true }));

    expect(response.status).toBe(403);
    expect(mockComputeMatchScore).not.toHaveBeenCalled();
  });

  it("allows admins to run requested tests", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

    const response = await POST(buildRequest({ scoring: true }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(mockComputeMatchScore).toHaveBeenCalled();
    expect(mockComputeMatchConfidence).toHaveBeenCalled();
  });
});
