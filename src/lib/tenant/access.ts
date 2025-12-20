import "server-only";

import type { IdentityUser } from "@/lib/auth/types";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { prisma } from "@/server/db/prisma";
import { normalizeTenantRole, TENANT_ROLES, type TenantRole } from "./roles";

export async function resolveTenantAdminAccess(
  user: IdentityUser | null,
  tenantId: string,
  options?: { roleHint?: TenantRole | null },
) {
  const normalizedTenantId = tenantId.trim();

  if (!user || !user.id) {
    return {
      hasAccess: false,
      isGlobalAdmin: false,
      membership: null,
      roleHint: options?.roleHint ?? null,
      reason: "No authenticated user",
    } as const;
  }

  if (!normalizedTenantId) {
    return {
      hasAccess: false,
      isGlobalAdmin: false,
      membership: null,
      roleHint: options?.roleHint ?? null,
      reason: "Missing tenant identifier",
    } as const;
  }

  const headerIndicatesAdmin = options?.roleHint === TENANT_ROLES.Admin;
  const isGlobalAdmin = isAdminOrDataAccessRole(user.role);

  if (isGlobalAdmin) {
    return {
      hasAccess: true,
      isGlobalAdmin,
      membership: null,
      roleHint: options?.roleHint ?? null,
      reason: headerIndicatesAdmin ? "Admin role supplied via header" : "Platform admin role",
    } as const;
  }

  const membership = await prisma.tenantUser.findUnique({
    where: {
      userId_tenantId: { userId: user.id, tenantId: normalizedTenantId },
    },
  });

  const membershipRole = normalizeTenantRole(membership?.role);
  const hasAccess = membershipRole === TENANT_ROLES.Admin;

  return {
    hasAccess,
    isGlobalAdmin,
    membership,
    roleHint: options?.roleHint ?? null,
    reason: hasAccess
      ? "Tenant admin membership verified"
      : membership
        ? "Tenant membership found without admin role"
        : "No tenant membership for user",
  } as const;
}

export function getTenantMembershipsForUser(userId: string) {
  return prisma.tenantUser.findMany({
    where: { userId },
    orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
  });
}
