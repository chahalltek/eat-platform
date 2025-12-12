import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resolveTenantAdminAccess: vi.fn(),
  buildGuardrailPerformanceReport: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mocks.resolveTenantAdminAccess,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: () => null,
}));

vi.mock("@/lib/guardrails/performance", () => ({
  buildGuardrailPerformanceReport: mocks.buildGuardrailPerformanceReport,
}));

import { GET } from "@/app/api/admin/tenant/[tenantId]/guardrails/performance/route";

describe("GET /api/admin/tenant/[tenantId]/guardrails/performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "ADMIN", tenantId: "tenant-1" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
    mocks.buildGuardrailPerformanceReport.mockResolvedValue({
      byPreset: [],
      deltas: [],
      jobAttribution: [],
      roleInsights: [],
    });
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const request = new Request("http://localhost/api/admin/tenant/demo/guardrails/performance");
    const response = await GET(request, { params: Promise.resolve({ tenantId: "demo" }) });

    expect(response.status).toBe(401);
  });

  it("enforces tenant admin access", async () => {
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });

    const request = new Request("http://localhost/api/admin/tenant/demo/guardrails/performance");
    const response = await GET(request, { params: Promise.resolve({ tenantId: "demo" }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
  });

  it("returns guardrail performance report for authorized admins", async () => {
    const report = {
      byPreset: [
        { preset: "balanced", totals: 5, interviews: 3, hires: 2, shortlisted: 4, falsePositives: 1, interviewRate: 60, hireRate: 40, falsePositiveRate: 25 },
      ],
      deltas: [],
      jobAttribution: [],
      roleInsights: [],
    };
    mocks.buildGuardrailPerformanceReport.mockResolvedValue(report);

    const request = new Request("http://localhost/api/admin/tenant/demo/guardrails/performance");
    const response = await GET(request, { params: Promise.resolve({ tenantId: "demo" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(report);
    expect(mocks.buildGuardrailPerformanceReport).toHaveBeenCalledWith("demo");
  });
});
