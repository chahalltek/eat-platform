import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import type { SystemModeName } from "@/lib/modes/systemModes";
import { isPrismaUnavailableError, isTableAvailable, prisma } from "@/server/db";

const fallbackRuntimeModes = new Map<string, SystemModeName>();

export type RuntimeModeSource = "database" | "fallback" | "memory";

export function isRuntimeControlsWriteEnabled(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.RUNTIME_CONTROLS_WRITE_ENABLED;
  if (!raw) return false;

  const normalized = raw.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

export async function loadRuntimeControlMode(tenantId: string) {
  if (fallbackRuntimeModes.has(tenantId)) {
    return { mode: fallbackRuntimeModes.get(tenantId)!, source: "memory" as RuntimeModeSource };
  }

  const loaded = await loadTenantMode(tenantId);

  return { mode: loaded.mode, source: loaded.source as RuntimeModeSource };
}

export async function persistRuntimeControlMode(
  tenant: { id: string; name?: string | null },
  mode: SystemModeName,
) {
  try {
    const hasTenantModeTable = await isTableAvailable("TenantMode");

    if (hasTenantModeTable) {
      const updated = await prisma.tenantMode.upsert({
        where: { tenantId: tenant.id },
        update: { mode },
        create: { tenantId: tenant.id, mode },
        include: { tenant: true },
      });

      return {
        id: updated.tenant.id,
        name: updated.tenant.name ?? tenant.name ?? tenant.id,
        mode: updated.mode as SystemModeName,
        source: "database" as RuntimeModeSource,
      };
    }
  } catch (error) {
    if (!isPrismaUnavailableError(error)) {
      throw error;
    }
  }

  fallbackRuntimeModes.set(tenant.id, mode);

  return { id: tenant.id, name: tenant.name ?? tenant.id, mode, source: "memory" as RuntimeModeSource };
}

export function resetRuntimeControlFallback() {
  fallbackRuntimeModes.clear();
}
