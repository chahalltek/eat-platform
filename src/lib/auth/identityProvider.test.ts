import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { createSessionCookie, SESSION_COOKIE_NAME } from "./session";

const { cookiesMock, headersMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

describe("identity provider abstraction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetIdentityProvider();
  });

  async function setMockSessionCookie() {
    const cookie = await createSessionCookie({
      id: "session-user",
      email: "session@example.com",
      displayName: "Session User",
      role: USER_ROLES.ADMIN,
      tenantId: "tenant-session",
    });

    cookiesMock.mockReturnValue({
      get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: cookie.value } : undefined),
    });

    headersMock.mockReturnValue(new Headers({ "x-eat-tenant-id": "tenant-session" }));

    return cookie.value;
  }

  it("reads the session cookie when no request is provided", async () => {
    await setMockSessionCookie();

    const user = await getCurrentUser();
    const claims = await getUserClaims();
    const roles = await getUserRoles();
    const tenantId = await getUserTenantId();
    const userId = await getCurrentUserId();

    expect(user).toEqual({
      id: "session-user",
      email: "session@example.com",
      displayName: "Session User",
      role: USER_ROLES.ADMIN,
      tenantId: "tenant-session",
    });
    expect(claims).toEqual({
      userId: "session-user",
      tenantId: "tenant-session",
      roles: [USER_ROLES.ADMIN],
      email: "session@example.com",
      displayName: "Session User",
    });
    expect(roles).toEqual([USER_ROLES.ADMIN]);
    expect(tenantId).toBe("tenant-session");
    expect(userId).toBe("session-user");
  });

  it("returns null claims when no session cookie is available", async () => {
    cookiesMock.mockReturnValue({ get: () => undefined });
    headersMock.mockReturnValue(new Headers());

    expect(await getCurrentUser()).toBeNull();
    expect(await getUserClaims()).toEqual({
      userId: null,
      tenantId: "default-tenant",
      roles: [],
      email: null,
      displayName: null,
    });
  });

  it("parses sessions directly from the incoming request", async () => {
    const cookieValue = await setMockSessionCookie();
    const request = new NextRequest("http://localhost/api/test", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });

    const user = await getCurrentUser(request);
    const claims = await getUserClaims(request);
    const tenantId = await getUserTenantId(request);

    expect(user?.id).toBe("session-user");
    expect(claims.userId).toBe("session-user");
    expect(tenantId).toBe("tenant-session");
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
