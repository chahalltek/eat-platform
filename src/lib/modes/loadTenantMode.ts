<<<<<<< ours
import { Prisma } from '@prisma/client';

import { getSystemMode } from '@/lib/systemMode';
import { isPrismaUnavailableError, prisma } from '@/lib/prisma';
import { getCurrentTenantId } from '@/lib/tenant';

export type TenantMode = {
  mode: string;
  agentsEnabled: string[];
};

function normalizeAgentsEnabled(metadata?: unknown): string[] {
  const asObject = (metadata ?? {}) as { agentsEnabled?: unknown };
  const fromMetadata = Array.isArray(asObject.agentsEnabled)
    ? asObject.agentsEnabled.map((entry) => String(entry)).filter(Boolean)
    : null;

  if (fromMetadata) return fromMetadata;

  const systemMode = getSystemMode();

  if (systemMode.fireDrill?.enabled && Array.isArray(systemMode.fireDrill.fireDrillImpact)) {
    return systemMode.fireDrill.fireDrillImpact;
  }

  return [];
}

export async function loadTenantMode(tenantId?: string): Promise<TenantMode> {
  const resolvedTenantId = tenantId ?? (await getCurrentTenantId());
  const systemModeModel = prisma.systemMode as typeof prisma.systemMode | undefined;

  const fallback = getSystemMode();

  if (!systemModeModel?.findFirst) {
    return { mode: fallback.mode, agentsEnabled: normalizeAgentsEnabled(fallback.fireDrill) };
  }

  const record = await systemModeModel
    .findFirst({ where: { tenantId: resolvedTenantId } })
    .catch((error) => {
      if (
        isPrismaUnavailableError(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021")
      ) {
        return null;
      }

      throw error;
    });

  return {
    mode: record?.mode ?? fallback.mode,
    agentsEnabled: normalizeAgentsEnabled(record?.metadata),
=======
import { prisma } from "@/lib/prisma";
import { SYSTEM_MODES, type SystemModeName } from "./systemModes";

export async function loadTenantMode(tenantId: string) {
  const record = await prisma.tenantMode.findUnique({ where: { tenantId } });

  const mode: SystemModeName = (record?.mode as SystemModeName) ?? "pilot";
  const definition = SYSTEM_MODES[mode];

  return {
    mode,
    guardrailsPreset: definition.guardrailsPreset,
    agentsEnabled: definition.agentsEnabled,
>>>>>>> theirs
  };
}
