import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resolveTenantAdminAccess: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mocks.resolveTenantAdminAccess,
}));

import { GET } from "@/app/api/admin/tenant/[tenantId]/guardrails/preview/route";

describe("GET /api/admin/tenant/[tenantId]/guardrails/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "ADMIN", tenantId: "tenant-1" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
  });

  it("returns the default sample shortlist when none is provided", async () => {
    const request = new Request("http://localhost/api/admin/tenant/demo/guardrails/preview");
    const response = await GET(request, { params: Promise.resolve({ tenantId: "demo" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sampleShortlist).toBe("sample5");
    expect(payload.scenario.sampleShortlist).toBe("sample5");
    expect(Array.isArray(payload.availableSamples)).toBe(true);
    expect(payload.availableSamples.length).toBeGreaterThan(0);
  });

  it("returns a requested sample shortlist when provided", async () => {
    const request = new Request(
      "http://localhost/api/admin/tenant/demo/guardrails/preview?sampleShortlist=sample3",
    );
    const response = await GET(request, { params: Promise.resolve({ tenantId: "demo" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sampleShortlist).toBe("sample3");
    expect(payload.scenario.sampleShortlist).toBe("sample3");
  });

  it("rejects unauthorized users", async () => {
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });

    const request = new Request("http://localhost/api/admin/tenant/demo/guardrails/preview");
    const response = await GET(request, { params: Promise.resolve({ tenantId: "demo" }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
  });
});
