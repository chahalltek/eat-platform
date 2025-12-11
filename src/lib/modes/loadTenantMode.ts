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
  };
}
