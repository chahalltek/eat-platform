import { prisma } from "@/lib/prisma";

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

  if (!tenantUser || tenantUser.role !== TENANT_ROLES.Admin) {
    return { isAdmin: false, tenantUser: tenantUser ?? undefined };
  }

  return { isAdmin: true, tenantUser };
}
