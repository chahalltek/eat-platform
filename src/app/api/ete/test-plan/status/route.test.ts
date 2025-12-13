import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockCanManageFeatureFlags = vi.hoisted(() => vi.fn());
const mockListTestPlanStatuses = vi.hoisted(() => vi.fn());
const mockParseTestPlanStatus = vi.hoisted(() => vi.fn());
const mockUpsertTestPlanStatus = vi.hoisted(() => vi.fn());
const mockIsValidTestPlanItemId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/auth/permissions", () => ({
  canManageFeatureFlags: mockCanManageFeatureFlags,
}));

vi.mock("@/lib/ete/testPlanStatus", () => ({
  listTestPlanStatuses: mockListTestPlanStatuses,
  parseTestPlanStatus: mockParseTestPlanStatus,
  upsertTestPlanStatus: mockUpsertTestPlanStatus,
}));

vi.mock("@/lib/ete/testPlanRegistry", () => ({
  isValidTestPlanItemId: mockIsValidTestPlanItemId,
}));

import { GET, POST } from "./route";

describe("/api/ete/test-plan/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanManageFeatureFlags.mockReturnValue(true);
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", tenantId: "tenant-a", email: "admin@example.com" });
    mockListTestPlanStatuses.mockResolvedValue({});
    mockParseTestPlanStatus.mockReturnValue("pass");
    mockUpsertTestPlanStatus.mockResolvedValue({
      itemId: "mvp.match",
      status: "pass",
      note: null,
      updatedBy: "admin@example.com",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    mockIsValidTestPlanItemId.mockReturnValue(true);
  });

  const buildGetRequest = () => makeRequest({ method: "GET", url: "http://localhost/api/ete/test-plan/status" });
  const buildPostRequest = (body: unknown) =>
    makeRequest({ method: "POST", url: "http://localhost/api/ete/test-plan/status", json: body });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(buildGetRequest());

    expect(response.status).toBe(401);
    expect(mockListTestPlanStatuses).not.toHaveBeenCalled();
  });

  it("blocks non-admin users", async () => {
    mockCanManageFeatureFlags.mockReturnValue(false);

    const response = await GET(buildGetRequest());

    expect(response.status).toBe(403);
    expect(mockListTestPlanStatuses).not.toHaveBeenCalled();
  });

  it("returns statuses for the current tenant", async () => {
    const payload = { "mvp.match": { status: "pass", note: null } };
    mockListTestPlanStatuses.mockResolvedValue(payload);

    const response = await GET(buildGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(payload);
    expect(mockListTestPlanStatuses).toHaveBeenCalledWith("tenant-a");
  });

  it("validates item ids on POST", async () => {
    mockIsValidTestPlanItemId.mockReturnValue(false);

    const response = await POST(buildPostRequest({ itemId: "bad-item", status: "pass" }));

    expect(response.status).toBe(400);
    expect(mockUpsertTestPlanStatus).not.toHaveBeenCalled();
  });

  it("saves statuses for valid requests", async () => {
    const response = await POST(buildPostRequest({ itemId: "mvp.match", status: "pass", note: "looks good" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      itemId: "mvp.match",
      status: "pass",
      note: null,
      updatedBy: "admin@example.com",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(mockParseTestPlanStatus).toHaveBeenCalledWith("pass");
    expect(mockUpsertTestPlanStatus).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      itemId: "mvp.match",
      status: "pass",
      note: "looks good",
      updatedBy: "admin@example.com",
    });
  });
});
