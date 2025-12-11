import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { type SystemModeName } from "@/lib/modes/systemModes";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export async function getTenantMode(tenantId?: string): Promise<SystemModeName> {
  const resolvedTenantId = tenantId ?? (await getCurrentTenantId());
  const loaded = await loadTenantMode(resolvedTenantId);

  return loaded.mode;
}

export async function updateTenantMode(tenantId: string, mode: SystemModeName) {
  const updated = await prisma.tenantMode.upsert({
    where: { tenantId },
    update: { mode },
    create: { tenantId, mode },
    include: { tenant: true },
  });

  return { id: updated.tenant.id, mode: updated.mode, name: updated.tenant.name };
}
