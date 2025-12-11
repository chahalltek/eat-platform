import type { IdentityUser } from "@/lib/auth/identityProvider";
import { isAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { normalizeTenantRole, TENANT_ROLES, type TenantRole } from "./roles";

export async function resolveTenantAdminAccess(
  user: IdentityUser | null,
  tenantId: string,
  options?: { roleHint?: TenantRole | null },
) {
  const normalizedTenantId = tenantId.trim();

  if (!user || !user.id || !normalizedTenantId) {
    return { hasAccess: false, isGlobalAdmin: false, membership: null } as const;
  }

  const isGlobalAdmin = isAdminRole(user.role);

  if (isGlobalAdmin) {
    return { hasAccess: true, isGlobalAdmin, membership: null } as const;
  }

  const membership = await prisma.tenantUser.findUnique({
    where: {
      userId_tenantId: { userId: user.id, tenantId: normalizedTenantId },
    },
  });

  const membershipRole = normalizeTenantRole(membership?.role);
  const hasAccess = isGlobalAdmin || membershipRole === TENANT_ROLES.Admin;

  console.log("diagnostics access check", {
    tenantId: normalizedTenantId,
    userId: user.id,
    headerRole: options?.roleHint ?? null,
    membershipRole: membershipRole ?? null,
    isGlobalAdmin,
    hasAccess,
  });

  return { hasAccess, isGlobalAdmin, membership } as const;
}

export function getTenantMembershipsForUser(userId: string) {
  return prisma.tenantUser.findMany({
    where: { userId },
    orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
  });
}
