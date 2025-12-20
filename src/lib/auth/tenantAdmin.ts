import "server-only";

import { prisma } from "@/server/db/prisma";
import { isTenantAdminRole } from "../tenant/roles";

export const TENANT_ROLES = {
  Admin: "Admin",
  Recruiter: "Recruiter",
} as const;

type RequireTenantAdminResult = {
  isAdmin: boolean;
  tenantUser?: {
    tenantId: string;
    userId: string;
    role: string;
  };
};

export async function requireTenantAdmin(
  tenantId: string,
  userId: string,
): Promise<RequireTenantAdminResult> {
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { tenantId, userId },
  });

  if (!tenantUser || !isTenantAdminRole(tenantUser.role)) {
    return { isAdmin: false, tenantUser: tenantUser ?? undefined };
  }

  return { isAdmin: true, tenantUser };
}
