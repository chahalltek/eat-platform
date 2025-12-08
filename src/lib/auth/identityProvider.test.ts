import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

import {
  DEFAULT_TENANT_ID,
  DEFAULT_USER_ID,
  TENANT_HEADER,
  TENANT_QUERY_PARAM,
  USER_HEADER,
  USER_QUERY_PARAM,
} from "./config";
import {
  getCurrentUser,
  getCurrentUserId,
  getUserClaims,
  getUserRoles,
  getUserTenantId,
  resetIdentityProvider,
  setIdentityProvider,
  type IdentityProvider,
} from "./identityProvider";
import { USER_ROLES, isAdminRole, normalizeRole } from "./roles";

const { headersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("identity provider abstraction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetIdentityProvider();
  });

  it("pulls user, tenant, and roles from query parameters when provided", async () => {
    const request = new NextRequest(
      `http://localhost/api/test?${USER_QUERY_PARAM}=dev-user&${TENANT_QUERY_PARAM}=tenant-query`,
    );

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "dev-user",
      email: "dev@example.com",
      displayName: "Dev User",
      role: USER_ROLES.ADMIN,
      tenantId: "tenant-from-user",
    } as never);

    const currentUser = await getCurrentUser(request);
    const roles = await getUserRoles(request);
    const tenantId = await getUserTenantId(request);
    const claims = await getUserClaims(request);

    expect(currentUser?.id).toBe("dev-user");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "dev-user" },
      select: { id: true, email: true, displayName: true, role: true, tenantId: true },
    });
    expect(roles).toEqual([USER_ROLES.ADMIN]);
    expect(tenantId).toBe("tenant-query");
    expect(claims).toEqual({
      userId: "dev-user",
      tenantId: "tenant-query",
      roles: [USER_ROLES.ADMIN],
      email: "dev@example.com",
      displayName: "Dev User",
    });
  });

  it("uses request headers when query params are absent", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: {
        [USER_HEADER]: "request-user",
        [TENANT_HEADER]: "request-tenant",
      },
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "request-user",
      email: "request@example.com",
      displayName: "Request User",
      role: USER_ROLES.SOURCER,
      tenantId: "tenant-from-profile",
    } as never);

    expect(await getCurrentUserId(request)).toBe("request-user");
    expect(await getUserTenantId(request)).toBe("request-tenant");
  });

  it("falls back to headers when no request is provided", async () => {
    headersMock.mockReturnValue(new Headers({
      [USER_HEADER]: "header-user",
      [TENANT_HEADER]: "header-tenant",
    }));

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "header-user",
      email: "header@example.com",
      displayName: "Header User",
      role: USER_ROLES.RECRUITER,
      tenantId: "tenant-header-user",
    } as never);

    const userId = await getCurrentUserId();
    const tenantId = await getUserTenantId();
    const roles = await getUserRoles();

    expect(userId).toBe("header-user");
    expect(tenantId).toBe("header-tenant");
    expect(roles).toEqual([USER_ROLES.RECRUITER]);
  });

  it("uses defaults when headers are empty", async () => {
    headersMock.mockReturnValue(new Headers());

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: DEFAULT_USER_ID,
      email: "default@example.com",
      displayName: "Default User",
      role: USER_ROLES.ADMIN,
      tenantId: "tenant-from-default",
    } as never);

    expect(await getCurrentUserId()).toBe(DEFAULT_USER_ID);
  });

  it("gracefully handles users missing profile fields", async () => {
    headersMock.mockReturnValue(new Headers({ [USER_HEADER]: "missing-fields" }));

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "missing-fields",
      email: null,
      displayName: null,
      role: USER_ROLES.RECRUITER,
      tenantId: null,
    } as never);

    const user = await getCurrentUser();
    const claims = await getUserClaims();

    expect(user?.displayName).toBeNull();
    expect(claims.email).toBeNull();
    expect(claims.displayName).toBeNull();
  });

  it("uses default identifiers and Prisma fallback when auth headers are missing", async () => {
    headersMock.mockImplementation(() => {
      throw new Error("headers unavailable");
    });

    const prismaError = new Prisma.PrismaClientKnownRequestError("Missing column", {
      clientVersion: "0",
      code: "P2022",
    });

    vi.mocked(prisma.user.findUnique)
      .mockRejectedValueOnce(prismaError as never)
      .mockResolvedValue({
        id: DEFAULT_USER_ID,
        email: "fallback@example.com",
        displayName: null,
        role: "sales",
        tenantId: null,
      } as never);

    const user = await getCurrentUser();
    const userId = await getCurrentUserId();
    const tenantId = await getUserTenantId();
    const roles = await getUserRoles();
    const claims = await getUserClaims();

    expect(user?.displayName).toBe("fallback@example.com");
    expect(userId).toBe(DEFAULT_USER_ID);
    expect(tenantId).toBe(DEFAULT_TENANT_ID);
    expect(roles).toEqual([USER_ROLES.SALES]);
    expect(claims).toEqual({
      userId: DEFAULT_USER_ID,
      tenantId: DEFAULT_TENANT_ID,
      roles: [USER_ROLES.SALES],
      email: "fallback@example.com",
      displayName: "fallback@example.com",
    });
  });

  it("returns null when fallback user cannot be loaded after schema mismatch", async () => {
    headersMock.mockReturnValue(new Headers());

    const prismaError = new Prisma.PrismaClientKnownRequestError("Missing column", {
      clientVersion: "0",
      code: "P2022",
    });

    vi.mocked(prisma.user.findUnique)
      .mockRejectedValueOnce(prismaError as never)
      .mockResolvedValue(null as never);

    expect(await getCurrentUser()).toBeNull();
    expect(await getUserClaims()).toEqual({
      userId: DEFAULT_USER_ID,
      tenantId: DEFAULT_TENANT_ID,
      roles: [],
      email: null,
      displayName: null,
    });
  });

  it("keeps null display names when fallback users lack email data", async () => {
    headersMock.mockReturnValue(new Headers());

    const prismaError = new Prisma.PrismaClientKnownRequestError("Missing column", {
      clientVersion: "0",
      code: "P2022",
    });

    vi.mocked(prisma.user.findUnique)
      .mockRejectedValueOnce(prismaError as never)
      .mockResolvedValue({
        id: DEFAULT_USER_ID,
        email: null,
        displayName: null,
        role: USER_ROLES.SALES,
        tenantId: null,
      } as never);

    const user = await getCurrentUser();
    expect(user?.displayName).toBeNull();
  });

  it("uses tenant from the user profile when no override is supplied", async () => {
    headersMock.mockReturnValue(new Headers());

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: DEFAULT_USER_ID,
      email: "tenantuser@example.com",
      displayName: "Tenant User",
      role: USER_ROLES.SALES,
      tenantId: "tenant-from-user",
    } as never);

    expect(await getUserTenantId()).toBe("tenant-from-user");
  });

  it("returns empty roles when normalization fails", async () => {
    const request = new NextRequest("http://localhost/no-role");

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: DEFAULT_USER_ID,
      email: "no-role@example.com",
      displayName: "No Role",
      role: "unrecognized",
      tenantId: "tenant-x",
    } as never);

    expect(await getUserRoles(request)).toEqual([]);
  });

  it("propagates unexpected Prisma errors", async () => {
    headersMock.mockReturnValue(new Headers({ [USER_HEADER]: "user-with-error" }));

    const prismaError = new Prisma.PrismaClientKnownRequestError("other failure", {
      clientVersion: "0",
      code: "P2021",
    });

    vi.mocked(prisma.user.findUnique).mockRejectedValue(prismaError as never);

    await expect(getCurrentUser()).rejects.toThrow("other failure");
  });

  it("allows swapping identity providers for future adapters", async () => {
    const fallbackProvider: IdentityProvider = {
      getCurrentUser: vi.fn().mockResolvedValue({
        id: "custom-user",
        email: "custom@example.com",
        displayName: "Custom User",
        role: USER_ROLES.SOURCER,
        tenantId: "custom-tenant",
      }),
      getUserClaims: vi.fn().mockResolvedValue({
        userId: "custom-user",
        tenantId: "custom-tenant",
        roles: [USER_ROLES.SOURCER],
        email: "custom@example.com",
        displayName: "Custom User",
      }),
      getUserTenantId: vi.fn().mockResolvedValue("custom-tenant"),
      getUserRoles: vi.fn().mockResolvedValue([USER_ROLES.SOURCER]),
    };

    setIdentityProvider(fallbackProvider);

    expect(await getCurrentUser()).toEqual({
      id: "custom-user",
      email: "custom@example.com",
      displayName: "Custom User",
      role: USER_ROLES.SOURCER,
      tenantId: "custom-tenant",
    });
    expect(await getUserClaims()).toEqual({
      userId: "custom-user",
      tenantId: "custom-tenant",
      roles: [USER_ROLES.SOURCER],
      email: "custom@example.com",
      displayName: "Custom User",
    });
    expect(await getUserTenantId()).toBe("custom-tenant");
    expect(await getUserRoles()).toEqual([USER_ROLES.SOURCER]);
  });

  it("detects admin roles via helper", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("sourcer")).toBe(false);
  });

  it("normalizes roles defensively", () => {
    expect(normalizeRole(" admin ")).toBe(USER_ROLES.ADMIN);
    expect(normalizeRole(undefined)).toBeNull();
  });
});
