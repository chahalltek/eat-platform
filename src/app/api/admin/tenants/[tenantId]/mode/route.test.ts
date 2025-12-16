import { Prisma } from "@prisma/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  canManageTenants: vi.fn(),
  getTenantMode: vi.fn(),
  updateTenantMode: vi.fn(),
  findTenant: vi.fn(),
}));

describe("/api/admin/tenants/[tenantId]/mode", () => {
  beforeAll(async () => {
    vi.mock("@/lib/auth/user", () => ({
      getCurrentUser: mocks.getCurrentUser,
    }));

    vi.mock("@/lib/auth/permissions", () => ({
      canManageTenants: mocks.canManageTenants,
    }));

    vi.mock("@/lib/tenantMode", () => ({
      getTenantMode: mocks.getTenantMode,
      updateTenantMode: mocks.updateTenantMode,
    }));

    vi.mock("@/server/db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/server/db")>();

      return {
        ...actual,
        prisma: {
          ...actual.prisma,
          tenant: {
            ...actual.prisma.tenant,
            findUnique: mocks.findTenant,
          },
        },
      } satisfies typeof actual;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.TESTS_DISABLED_IN_THIS_ENVIRONMENT;
    delete process.env.testsDisabledInThisEnvironment;
    delete process.env.HOSTING_ON_VERCEL;
    delete process.env["hosting-on-vercel"];
    delete process.env.VERCEL;
  });

  it("returns the current tenant mode", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.canManageTenants.mockReturnValue(true);
    mocks.findTenant.mockResolvedValue({ id: "tenant-1" });
    mocks.getTenantMode.mockResolvedValue("sandbox");

    const response = await GET(makeRequest({ method: "GET", url: "http://localhost/api/admin/tenants/tenant-1/mode" }), {
      params: Promise.resolve({ tenantId: "tenant-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tenantId: "tenant-1", mode: "sandbox", warnings: [] });
  });

  it("blocks writes when the environment gate is locked", async () => {
    process.env.TESTS_DISABLED_IN_THIS_ENVIRONMENT = "true";
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.canManageTenants.mockReturnValue(true);
    mocks.findTenant.mockResolvedValue({ id: "tenant-1" });

    const response = await PATCH(
      makeRequest({
        method: "PATCH",
        url: "http://localhost/api/admin/tenants/tenant-1/mode",
        json: { mode: "pilot" },
      }),
      { params: Promise.resolve({ tenantId: "tenant-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ warnings: ["write-locked"], error: expect.any(String) });
    expect(mocks.updateTenantMode).not.toHaveBeenCalled();
  });

  it("updates tenant mode when authorized", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.canManageTenants.mockReturnValue(true);
    mocks.findTenant.mockResolvedValue({ id: "tenant-1" });
    mocks.updateTenantMode.mockResolvedValue({ id: "tenant-1", mode: "production", name: "Tenant One" });

    const response = await PATCH(
      makeRequest({
        method: "PATCH",
        url: "http://localhost/api/admin/tenants/tenant-1/mode",
        json: { mode: "production" },
      }),
      { params: Promise.resolve({ tenantId: "tenant-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tenant: { id: "tenant-1", mode: "production", name: "Tenant One" },
      warnings: [],
    });
    expect(mocks.updateTenantMode).toHaveBeenCalledWith("tenant-1", "production");
  });

  it("returns a warning instead of failing when schema drift occurs", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.canManageTenants.mockReturnValue(true);
    mocks.findTenant.mockResolvedValue({ id: "tenant-1" });
    mocks.getTenantMode.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Missing column", {
        code: "P2022",
        clientVersion: "5.19.0",
      }),
    );

    const response = await GET(makeRequest({ method: "GET", url: "http://localhost/api/admin/tenants/tenant-1/mode" }), {
      params: Promise.resolve({ tenantId: "tenant-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tenantId: "tenant-1", mode: "pilot", warnings: ["schema-mismatch"] });
  });
});
