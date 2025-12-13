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

  const headerIndicatesAdmin = options?.roleHint === TENANT_ROLES.Admin;
  const isGlobalAdmin = isAdminRole(user.role) || headerIndicatesAdmin;

  if (isGlobalAdmin) {
    return { hasAccess: true, isGlobalAdmin, membership: null } as const;
  }

  const membership = await prisma.tenantUser.findUnique({
    where: {
      userId_tenantId: { userId: user.id, tenantId: normalizedTenantId },
    },
  });

  const membershipRole = normalizeTenantRole(membership?.role);
  const hasAccess =
    isGlobalAdmin || headerIndicatesAdmin || membershipRole === TENANT_ROLES.Admin;

  return { hasAccess, isGlobalAdmin, membership } as const;
}

export function getTenantMembershipsForUser(userId: string) {
  return prisma.tenantUser.findMany({
    where: { userId },
    orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
  });
}
