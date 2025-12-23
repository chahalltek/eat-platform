import "server-only";

import { prisma } from "@/server/db/prisma";

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  role: string | null;
  status: string | null;
  tenantId: string;
  tenantRole: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listUsersForTenant(tenantId: string): Promise<AdminUserSummary[]> {
  const users = await prisma.user.findMany({
    where: { tenantId, status: { not: "DELETED" } },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
      tenantMemberships: {
        where: { tenantId },
        select: { role: true },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    tenantId: user.tenantId,
    tenantRole: user.tenantMemberships[0]?.role ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));
}
