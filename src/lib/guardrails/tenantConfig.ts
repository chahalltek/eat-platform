import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { guardrailsPresets, type GuardrailsConfig, type GuardrailsPresetName } from "./presets";

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(base: JsonObject, override?: unknown): JsonObject {
  const result: JsonObject = structuredClone(base);

  if (!isPlainObject(override)) {
    return result;
  }

  for (const [key, value] of Object.entries(override)) {
    const current = result[key];

    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = mergeConfig(current, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function normalizePreset(preset: string | null | undefined): GuardrailsPresetName | null {
  if (!preset) return null;

  const names: GuardrailsPresetName[] = ["conservative", "balanced", "aggressive"];

  return names.includes(preset as GuardrailsPresetName) ? (preset as GuardrailsPresetName) : null;
}

export type TenantGuardrailsConfig = GuardrailsConfig & { preset: GuardrailsPresetName | null };

const balancedPreset = guardrailsPresets.balanced;

export async function loadTenantConfig(tenantId?: string): Promise<TenantGuardrailsConfig> {
  const resolvedTenantId = tenantId ?? (await getCurrentTenantId());

  const storedConfig = await prisma.tenantConfig.findFirst({ where: { tenantId: resolvedTenantId } });

  const preset = normalizePreset((storedConfig?.preset as string | null | undefined) ?? null);
  const presetConfig = preset ? guardrailsPresets[preset] : balancedPreset;

  const scoring = mergeConfig(presetConfig.scoring, storedConfig?.scoring ?? undefined);
  const explain = mergeConfig(presetConfig.explain, storedConfig?.explain ?? undefined);
  const safety = mergeConfig(presetConfig.safety, storedConfig?.safety ?? undefined);
  const shortlist = mergeConfig(
    presetConfig.shortlist ?? {},
    (storedConfig as { shortlist?: unknown } | undefined)?.shortlist ?? undefined,
  );

  return {
    scoring,
    explain,
    safety,
    shortlist,
    preset,
  } satisfies TenantGuardrailsConfig;
}
