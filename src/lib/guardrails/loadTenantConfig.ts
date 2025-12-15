import { prisma } from "@/server/db";
import { defaultTenantGuardrails } from "./defaultTenantConfig";
import { withTenantConfigSchemaFallback } from "@/lib/tenant/tenantConfigSchemaFallback";

function coerceGuardrailSection(value: unknown) {
  return value && typeof value === "object" ? value : {};
}

function coerceNetworkLearning(value: unknown) {
  if (value && typeof value === "object" && value !== null && "enabled" in value) {
    return { enabled: Boolean((value as { enabled?: unknown }).enabled) };
  }

  return { ...defaultTenantGuardrails.networkLearning };
}

function mergeSafetySection(value: unknown) {
  const safetyOverrides = coerceGuardrailSection(value) as Record<string, unknown>;
  const bandOverrides = coerceGuardrailSection(safetyOverrides.confidenceBands);

  return {
    ...defaultTenantGuardrails.safety,
    ...safetyOverrides,
    confidenceBands: {
      ...defaultTenantGuardrails.safety.confidenceBands,
      ...bandOverrides,
    },
  };
}

export async function loadTenantConfig(tenantId: string) {
  const { result: existing, schemaMismatch } = await withTenantConfigSchemaFallback(
    () =>
      prisma.tenantConfig.findUnique({
        where: { tenantId },
      }),
    { tenantId },
  );

  if (!existing) {
    return {
      ...defaultTenantGuardrails,
      preset: null,
      schemaMismatch,
      _source: "default" as const,
    };
  }

  return {
    preset: schemaMismatch ? null : existing.preset ?? null,
    scoring: { ...defaultTenantGuardrails.scoring, ...coerceGuardrailSection(existing.scoring) },
    explain: { ...defaultTenantGuardrails.explain, ...coerceGuardrailSection(existing.explain) },
    safety: mergeSafetySection(existing.safety),
    llm: schemaMismatch
      ? {}
      : { ...defaultTenantGuardrails.llm, ...coerceGuardrailSection((existing as { llm?: unknown }).llm) },
    networkLearning: schemaMismatch
      ? { enabled: false }
      : coerceNetworkLearning((existing as { networkLearning?: unknown }).networkLearning),
    schemaMismatch,
    _source: "db" as const,
  };
}
