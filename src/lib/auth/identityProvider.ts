import type { NextRequest } from "next/server";

import { prisma } from "@/server/db/prisma";

import { DEFAULT_TENANT_ID, PERMISSIONS_HEADER } from "./config";
import type { IdentityProvider, IdentityUser, IdentityClaims } from "./types";
import { normalizeRole, type UserRole } from "./roles";
import { getSessionClaims } from "./session";

async function resolveSession(req?: NextRequest) {
  return getSessionClaims(req);
}

function resolveRoles(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized ? [normalized] : [];
}

function resolvePermissions(value: unknown) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : null))
      .filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

async function readHeader(name: string) {
  if (typeof window !== "undefined") {
    return null;
  }

  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    return headerList.get(name);
  } catch {
    return null;
  }
}

async function resolveTenantId(req: NextRequest | undefined, tenantId: string | null | undefined) {
  if (tenantId && tenantId.trim()) {
    return tenantId.trim();
  }

  const headerValue = req?.headers.get("x-eat-tenant-id") ?? (await readHeader("x-eat-tenant-id"));

  if (headerValue && headerValue.trim()) {
    return headerValue.trim();
  }

  return DEFAULT_TENANT_ID;
}

async function resolveUserFromHeaders(req?: NextRequest) {
  const userId = req?.headers.get("x-eat-user-id") ?? (await readHeader("x-eat-user-id"));
  const role = req?.headers.get("x-eat-user-role") ?? (await readHeader("x-eat-user-role"));
  const email = req?.headers.get("x-eat-user-email") ?? (await readHeader("x-eat-user-email"));
  const displayName = req?.headers.get("x-eat-user-name") ?? (await readHeader("x-eat-user-name"));
  const permissionsHeader = req?.headers.get(PERMISSIONS_HEADER) ?? (await readHeader(PERMISSIONS_HEADER));
  const tenantId = await resolveTenantId(req, null);

  if (!userId || !userId.trim()) {
    return null;
  }

  return {
    id: userId.trim(),
    role: role?.trim() ?? null,
    email: email?.trim() ?? null,
    displayName: displayName?.trim() ?? email?.trim() ?? null,
    permissions: resolvePermissions(permissionsHeader),
    tenantId,
  };
}

async function resolveUserFromDatabase(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, displayName: true, tenantId: true, status: true },
    });
  } catch (error) {
    console.warn("Failed to load user for identity resolution", error);
    return null;
  }
}

async function resolveUserFromSession(req: NextRequest | undefined) {
  const session = await resolveSession(req);
  if (!session) {
    return { user: null, roles: [] as UserRole[], tenantId: DEFAULT_TENANT_ID };
  }

  const [databaseUser, resolvedTenantId] = await Promise.all([
    resolveUserFromDatabase(session.userId),
    resolveTenantId(req, session.tenantId ?? null),
  ]);

  if (!databaseUser || databaseUser.status === "SUSPENDED" || databaseUser.status === "DELETED") {
    return { user: null, roles: [] as UserRole[], tenantId: resolvedTenantId };
  }

  const roleSource = session.role ?? databaseUser?.role ?? null;
  const roles = resolveRoles(roleSource);
  const tenantId = databaseUser?.tenantId ?? resolvedTenantId;
  const email = session.email ?? databaseUser?.email ?? null;
  const displayName = session.displayName ?? session.email ?? databaseUser?.displayName ?? databaseUser?.email ?? null;
  const permissions = resolvePermissions(session.permissions);

  return {
    user: {
      id: session.userId,
      email,
      displayName,
      role: roles[0] ?? roleSource,
      permissions,
      tenantId,
    },
    roles,
    tenantId,
  };
}

function createLocalIdentityProvider(): IdentityProvider {
  return {
    async getCurrentUser(req?: NextRequest) {
      const { user } = await resolveUserFromSession(req);
      if (user) return user;

      return resolveUserFromHeaders(req);
    },

    async getUserRoles(req?: NextRequest) {
      const { roles } = await resolveUserFromSession(req);
      if (roles.length) return roles;

      const fromHeaders = await resolveUserFromHeaders(req);
      return resolveRoles(fromHeaders?.role);
    },

    async getUserTenantId(req?: NextRequest) {
      const { tenantId } = await resolveUserFromSession(req);
      return tenantId;
    },

    async getUserClaims(req?: NextRequest) {
      const { user, roles, tenantId } = await resolveUserFromSession(req);

      if (user) {
        return {
          userId: user.id,
          tenantId,
          roles,
          permissions: resolvePermissions(user.permissions),
          email: user.email ?? null,
          displayName: user.displayName ?? user.email ?? null,
        };
      }

      const fromHeaders = await resolveUserFromHeaders(req);

      if (!fromHeaders) {
        return { userId: null, tenantId: DEFAULT_TENANT_ID, roles: [], permissions: [], email: null, displayName: null };
      }

      const [fallbackRoles, fallbackTenantId] = await Promise.all([
        resolveRoles(fromHeaders.role),
        resolveTenantId(req, fromHeaders.tenantId ?? null),
      ]);

      return {
        userId: fromHeaders.id,
        tenantId: fallbackTenantId,
        roles: fallbackRoles,
        permissions: resolvePermissions(fromHeaders.permissions),
        email: fromHeaders.email,
        displayName: fromHeaders.displayName ?? fromHeaders.email,
      };
    },
  };
}

let identityProvider: IdentityProvider = createLocalIdentityProvider();

export function setIdentityProvider(provider: IdentityProvider) {
  identityProvider = provider;
}

export function resetIdentityProvider() {
  identityProvider = createLocalIdentityProvider();
}

export function getCurrentUser(req?: NextRequest) {
  return identityProvider.getCurrentUser(req);
}

export async function getCurrentUserId(req?: NextRequest) {
  const claims = await identityProvider.getUserClaims(req);
  return claims.userId;
}

export function getUserClaims(req?: NextRequest) {
  return identityProvider.getUserClaims(req);
}

export function getUserTenantId(req?: NextRequest) {
  return identityProvider.getUserTenantId(req);
}

export function getUserRoles(req?: NextRequest) {
  return identityProvider.getUserRoles(req);
}
