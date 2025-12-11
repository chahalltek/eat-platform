import { TenantMode } from "@prisma/client";

import { isPrismaUnavailableError, prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export async function getTenantMode(tenantId?: string): Promise<TenantMode | null> {
  try {
    const resolvedTenantId = tenantId ?? (await getCurrentTenantId());
    const tenant = await prisma.tenant.findUnique({ where: { id: resolvedTenantId }, select: { mode: true } });

    return tenant?.mode ?? null;
  } catch (error) {
    if (!isPrismaUnavailableError(error)) {
      console.error("[tenant-mode] failed to load tenant mode", error);
    }

    return null;
  }
}

export async function updateTenantMode(tenantId: string, mode: TenantMode) {
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { mode },
    select: { id: true, mode: true, name: true },
  });

  return updated;
}
