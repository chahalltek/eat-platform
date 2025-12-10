import type { IdentityUser } from "@/lib/auth/identityProvider";
import { isAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

function isTenantAdminRole(role: string | null | undefined) {
  return (role ?? "").trim().toUpperCase() === "ADMIN";
}

export async function resolveTenantAdminAccess(user: IdentityUser | null, tenantId: string) {
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

  const hasAccess = isTenantAdminRole(membership?.role);

  return { hasAccess, isGlobalAdmin, membership } as const;
}

export function getTenantMembershipsForUser(userId: string) {
  return prisma.tenantUser.findMany({
    where: { userId },
    orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
  });
}
