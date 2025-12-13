import { afterEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

import { GET } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const listTenantsWithPlans = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({ getCurrentUser }));
vi.mock("@/lib/admin/tenants", () => ({ listTenantsWithPlans }));

describe("GET /api/admin/tenants", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin users", async () => {
    getCurrentUser.mockResolvedValue({ role: "recruiter" });

    const request = makeRequest({ method: "GET", url: "http://localhost/api/admin/tenants" });
    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("lists tenants for administrators", async () => {
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    listTenantsWithPlans.mockResolvedValue([
      {
        id: "tenant-1",
        name: "Tenant One",
        status: "active",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        plan: { id: "plan-a", name: "Starter" },
        isTrial: false,
        trialEndsAt: null,
      },
    ]);

    const request = makeRequest({ method: "GET", url: "http://localhost/api/admin/tenants" });
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.tenants).toEqual([
      {
        id: "tenant-1",
        name: "Tenant One",
        status: "active",
        createdAt: "2024-01-01T00:00:00.000Z",
        plan: { id: "plan-a", name: "Starter" },
        isTrial: false,
        trialEndsAt: null,
      },
    ]);
  });
});
