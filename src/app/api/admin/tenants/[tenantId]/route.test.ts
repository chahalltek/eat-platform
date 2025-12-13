import { afterEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

import { GET, PATCH } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const getTenantPlanDetail = vi.hoisted(() => vi.fn());
const updateTenantPlan = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({ getCurrentUser }));
vi.mock("@/lib/admin/tenants", () => ({
  getTenantPlanDetail,
  updateTenantPlan,
  NotFoundError: class MockNotFound extends Error {},
  ValidationError: class MockValidationError extends Error {},
}));

describe("/api/admin/tenants/[tenantId]", () => {
  const params = { params: { tenantId: "tenant-1" } } as const;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("blocks non-admin access", async () => {
    getCurrentUser.mockResolvedValue({ role: "recruiter" });
    const request = makeRequest({ method: "GET", url: "http://localhost/api/admin/tenants/tenant-1" });

    const response = await GET(request, params);

    expect(response.status).toBe(403);
  });

  it("returns tenant details", async () => {
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    getTenantPlanDetail.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        name: "Tenant One",
        status: "active",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        plan: { id: "plan-a", name: "Starter" },
        isTrial: true,
        trialEndsAt: new Date("2024-02-01T00:00:00.000Z"),
      },
      plans: [
        { id: "plan-a", name: "Starter", limits: {}, createdAt: new Date("2024-01-01T00:00:00.000Z") },
        { id: "plan-b", name: "Pro", limits: {}, createdAt: new Date("2024-01-02T00:00:00.000Z") },
      ],
    });

    const request = makeRequest({ method: "GET", url: "http://localhost/api/admin/tenants/tenant-1" });
    const response = await GET(request, params);
    const payload = await response.json();

    expect(payload.tenant.trialEndsAt).toBe("2024-02-01T00:00:00.000Z");
    expect(payload.plans).toHaveLength(2);
  });

  it("returns 404 when detail is missing", async () => {
    const MockNotFound = (await import("@/lib/admin/tenants")).NotFoundError;
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    getTenantPlanDetail.mockRejectedValue(new MockNotFound("not found"));

    const request = makeRequest({ method: "GET", url: "http://localhost/api/admin/tenants/tenant-1" });
    const response = await GET(request, params);

    expect(response.status).toBe(404);
  });

  it("requires planId when updating", async () => {
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    const request = makeRequest({ method: "PATCH", url: "http://localhost/api/admin/tenants/tenant-1", body: "{}" });
    const response = await PATCH(request, params);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "planId is required" });
  });

  it("updates tenant plan", async () => {
    getCurrentUser.mockResolvedValue({ role: "SYSTEM_ADMIN" });
    updateTenantPlan.mockResolvedValue({
      id: "tenant-1",
      name: "Tenant One",
      status: "active",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      plan: { id: "plan-b", name: "Pro" },
      isTrial: false,
      trialEndsAt: null,
    });

    const request = makeRequest({
      method: "PATCH",
      url: "http://localhost/api/admin/tenants/tenant-1",
      json: { planId: "plan-b", isTrial: false },
    });

    const response = await PATCH(request, params);
    const payload = await response.json();

    expect(updateTenantPlan).toHaveBeenCalledWith("tenant-1", "plan-b", {
      isTrial: false,
      trialEndsAt: null,
    });
    expect(payload.tenant.plan?.id).toBe("plan-b");
  });

  it("surfaces validation errors", async () => {
    const MockValidation = (await import("@/lib/admin/tenants")).ValidationError;
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    updateTenantPlan.mockRejectedValue(new MockValidation("bad date"));

    const request = makeRequest({
      method: "PATCH",
      url: "http://localhost/api/admin/tenants/tenant-1",
      json: { planId: "plan-b", trialEndsAt: "not-a-date" },
    });

    const response = await PATCH(request, params);
    expect(response.status).toBe(400);
  });
});
