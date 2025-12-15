import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resolveTenantAdminAccess: vi.fn(),
  getTenantRoleFromHeaders: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mocks.resolveTenantAdminAccess,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: mocks.getTenantRoleFromHeaders,
}));

vi.mock("@/lib/guardrails/recommendations", () => ({
  guardrailRecommendationEngine: { generate: mocks.generate },
}));

import { GET } from "@/app/api/admin/tenant/[tenantId]/guardrails/recommendations/route";

describe("GET /api/admin/tenant/[tenantId]/guardrails/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "ADMIN", tenantId: "tenant-1" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: false, membership: null });
    mocks.getTenantRoleFromHeaders.mockReturnValue(null);
    mocks.generate.mockResolvedValue([]);
  });

  it("surfaces schema mismatches without failing", async () => {
    const schemaMismatch = new Prisma.PrismaClientKnownRequestError("Missing column preset", {
      code: "P2022",
      clientVersion: "5.19.0",
    });

    mocks.generate.mockRejectedValueOnce(schemaMismatch);

    const request = new Request("http://localhost/api/admin/tenant/demo/guardrails/recommendations");
    const response = await GET(request, { params: Promise.resolve({ tenantId: "demo" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      recommendations: [],
      suggestions: [],
      status: "unavailable",
      reason: "schema-mismatch",
    });
    expect(mocks.generate).toHaveBeenCalledWith("demo");
  });
});

