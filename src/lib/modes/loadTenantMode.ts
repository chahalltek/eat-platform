import { Prisma } from "@prisma/client";

import { isPrismaUnavailableError, isTableAvailable, prisma } from "@/lib/prisma";
import { SYSTEM_MODES, type SystemModeName } from "./systemModes";

const DEFAULT_MODE: SystemModeName = "pilot";
const DEFAULT_DEFINITION = SYSTEM_MODES[DEFAULT_MODE];

function isMissingTableError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2021");
}

type ModeSource = "database" | "fallback";

function buildFallbackMode(): { mode: SystemModeName; guardrailsPreset: string; agentsEnabled: string[]; source: ModeSource } {
  return {
    mode: DEFAULT_MODE,
    guardrailsPreset: DEFAULT_DEFINITION.guardrailsPreset,
    agentsEnabled: DEFAULT_DEFINITION.agentsEnabled,
    source: "fallback",
  };
}

export async function loadTenantMode(tenantId: string) {
  try {
    const tenantModeAvailable = await isTableAvailable("TenantMode");
    if (!tenantModeAvailable) {
      return buildFallbackMode();
    }

    const tenantModeModel = prisma.tenantMode as typeof prisma.tenantMode | undefined;

    if (!tenantModeModel?.findUnique) {
      return buildFallbackMode();
    }

    const record = await tenantModeModel.findUnique({ where: { tenantId } });

    const mode: SystemModeName = (record?.mode as SystemModeName) ?? DEFAULT_MODE;
    const definition = SYSTEM_MODES[mode] ?? DEFAULT_DEFINITION;

    return {
      mode,
      guardrailsPreset: definition.guardrailsPreset,
      agentsEnabled: definition.agentsEnabled,
      source: record ? "database" : "fallback",
    };
  } catch (error) {
    if (isPrismaUnavailableError(error) || isMissingTableError(error)) {
      return buildFallbackMode();
    }

    throw error;
  }
}
