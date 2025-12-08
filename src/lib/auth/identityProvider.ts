import { headers } from "next/headers";
import type { NextRequest } from "next/server";

import { DEFAULT_TENANT_ID } from "./config";
import { getSessionClaims } from "./session";
import { normalizeRole, type UserRole } from "./roles";

export type IdentityUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string | null;
  tenantId?: string | null;
};

export type IdentityClaims = {
  userId: string | null;
  tenantId: string | null;
  roles: UserRole[];
  email?: string | null;
  displayName?: string | null;
};

export interface IdentityProvider {
  getCurrentUser(req?: NextRequest): Promise<IdentityUser | null>;
  getUserClaims(req?: NextRequest): Promise<IdentityClaims>;
  getUserTenantId(req?: NextRequest): Promise<string | null>;
  getUserRoles(req?: NextRequest): Promise<UserRole[]>;
}

async function resolveSession(req?: NextRequest) {
  return getSessionClaims(req);
}

function resolveRoles(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized ? [normalized] : [];
}

async function resolveTenantId(req: NextRequest | undefined, tenantId: string | null | undefined) {
  if (tenantId && tenantId.trim()) {
    return tenantId.trim();
  }

  try {
    const headerList = await headers();
    const headerValue = headerList.get("x-eat-tenant-id");

    if (headerValue && headerValue.trim()) {
      return headerValue.trim();
    }
  } catch {
    // ignore header access errors
  }

  return DEFAULT_TENANT_ID;
}

function createLocalIdentityProvider(): IdentityProvider {
  return {
    async getCurrentUser(req?: NextRequest) {
      const session = await resolveSession(req);
      if (!session) return null;

      return {
        id: session.userId,
        email: session.email ?? null,
        displayName: session.displayName ?? session.email ?? null,
        role: session.role ?? null,
        tenantId: session.tenantId ?? DEFAULT_TENANT_ID,
      };
    },

    async getUserRoles(req?: NextRequest) {
      const session = await resolveSession(req);
      if (!session) return [];

      return resolveRoles(session.role);
    },

    async getUserTenantId(req?: NextRequest) {
      const session = await resolveSession(req);
      return resolveTenantId(req, session?.tenantId ?? null);
    },

    async getUserClaims(req?: NextRequest) {
      const session = await resolveSession(req);

      if (!session) {
        return { userId: null, tenantId: DEFAULT_TENANT_ID, roles: [], email: null, displayName: null };
      }

      const [roles, tenantId] = await Promise.all([
        resolveRoles(session.role),
        resolveTenantId(req, session.tenantId ?? null),
      ]);

      return {
        userId: session.userId,
        tenantId,
        roles,
        email: session.email ?? null,
        displayName: session.displayName ?? session.email ?? null,
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
