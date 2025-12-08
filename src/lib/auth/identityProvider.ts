import { headers } from "next/headers";
import type { NextRequest } from "next/server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  DEFAULT_TENANT_ID,
  DEFAULT_USER_ID,
  TENANT_HEADER,
  TENANT_QUERY_PARAM,
  USER_HEADER,
  USER_QUERY_PARAM,
} from "./config";
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

function extractValueFromRequest(req: NextRequest, queryKey: string, headerKey: string) {
  const queryValue = req.nextUrl.searchParams.get(queryKey);

  if (queryValue && queryValue.trim()) {
    return queryValue.trim();
  }

  const headerValue = req.headers.get(headerKey);

  if (headerValue && headerValue.trim()) {
    return headerValue.trim();
  }

  return null;
}

async function extractValueFromHeaders(headerKey: string) {
  const headerList = await headers();

  const headerValue = headerList.get(headerKey);

  if (headerValue && headerValue.trim()) {
    return headerValue.trim();
  }

  return null;
}

async function resolveUserId(req?: NextRequest) {
  if (req) {
    return extractValueFromRequest(req, USER_QUERY_PARAM, USER_HEADER) ?? DEFAULT_USER_ID;
  }

  try {
    const headerUserId = await extractValueFromHeaders(USER_HEADER);
    return headerUserId ?? DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

async function resolveRequestedTenantId(req?: NextRequest) {
  if (req) {
    return extractValueFromRequest(req, TENANT_QUERY_PARAM, TENANT_HEADER);
  }

  try {
    return await extractValueFromHeaders(TENANT_HEADER);
  } catch {
    return null;
  }
}

async function fetchUserById(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, role: true, tenantId: true },
    });

    return user ? { ...user, displayName: user.displayName ?? user.email ?? null } : null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      const fallbackUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, tenantId: true },
      });

      return fallbackUser
        ? { ...fallbackUser, displayName: fallbackUser.email ?? null }
        : null;
    }

    throw error;
  }
}

function resolveRoles(user: IdentityUser | null) {
  const normalized = normalizeRole(user?.role);
  return normalized ? [normalized] : [];
}

async function resolveTenantId(req: NextRequest | undefined, user: IdentityUser | null) {
  const requestedTenant = await resolveRequestedTenantId(req);

  if (requestedTenant) {
    return requestedTenant;
  }

  if (user?.tenantId && user.tenantId.trim()) {
    return user.tenantId.trim();
  }

  return DEFAULT_TENANT_ID;
}

function createLocalIdentityProvider(): IdentityProvider {
  return {
    async getCurrentUser(req?: NextRequest) {
      const userId = await resolveUserId(req);

      return fetchUserById(userId);
    },

    async getUserRoles(req?: NextRequest) {
      const user = await this.getCurrentUser(req);
      return resolveRoles(user);
    },

    async getUserTenantId(req?: NextRequest) {
      const user = await this.getCurrentUser(req);
      return resolveTenantId(req, user);
    },

    async getUserClaims(req?: NextRequest) {
      const userPromise = this.getCurrentUser(req);
      const userIdPromise = resolveUserId(req);

      const [user, roles, tenantId, userId] = await Promise.all([
        userPromise,
        this.getUserRoles(req),
        this.getUserTenantId(req),
        userIdPromise,
      ]);

      return {
        userId,
        tenantId,
        roles,
        email: user?.email ?? null,
        displayName: user?.displayName ?? null,
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
