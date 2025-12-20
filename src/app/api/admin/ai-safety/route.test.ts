import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetLlmSafetyStatus = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/server/ai/safety/config", () => ({
  getLlmSafetyStatus: mockGetLlmSafetyStatus,
}));

import { GET } from "./route";

describe("GET /api/admin/ai-safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLlmSafetyStatus.mockReturnValue({
      ok: true,
      environment: "test",
      requireLlmSafety: true,
      redactionEnabled: true,
      allowlistEnabled: true,
      promptLoggingEnabled: false,
      promptLoggingRedacted: true,
      issues: [],
    });
  });

  it("requires authentication", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(makeRequest({ url: "http://localhost/api/admin/ai-safety" }));

    expect(response.status).toBe(401);
    expect(mockGetLlmSafetyStatus).not.toHaveBeenCalled();
  });

  it("blocks callers without environment visibility", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "RECRUITER",
      tenantId: "tenant-1",
      email: null,
      displayName: null,
    });

    const response = await GET(makeRequest({ url: "http://localhost/api/admin/ai-safety" }));

    expect(response.status).toBe(403);
    expect(mockGetLlmSafetyStatus).not.toHaveBeenCalled();
  });

  it("returns the safety status for admins", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      tenantId: "tenant-1",
      email: "admin@example.com",
      displayName: "Admin",
    });
    mockGetLlmSafetyStatus.mockReturnValueOnce({
      ok: false,
      environment: "production",
      requireLlmSafety: false,
      redactionEnabled: false,
      allowlistEnabled: false,
      promptLoggingEnabled: true,
      promptLoggingRedacted: false,
      issues: ["Example issue"],
    });

    const response = await GET(makeRequest({ url: "http://localhost/api/admin/ai-safety" }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.issues).toContain("Example issue");
    expect(mockGetLlmSafetyStatus).toHaveBeenCalledTimes(1);
  });
});
