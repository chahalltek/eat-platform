import { prisma } from "@/lib/prisma";
import { defaultTenantGuardrails } from "./defaultTenantConfig";

function coerceGuardrailSection(value: unknown) {
  return value && typeof value === "object" ? value : {};
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
  const existing = await prisma.tenantConfig.findUnique({
    where: { tenantId },
  });

  if (!existing) {
    return {
      ...defaultTenantGuardrails,
      preset: null,
      _source: "default" as const,
    };
  }

  return {
    preset: existing.preset ?? null,
    scoring: { ...defaultTenantGuardrails.scoring, ...coerceGuardrailSection(existing.scoring) },
    explain: { ...defaultTenantGuardrails.explain, ...coerceGuardrailSection(existing.explain) },
    safety: mergeSafetySection(existing.safety),
    llm: { ...defaultTenantGuardrails.llm, ...coerceGuardrailSection((existing as { llm?: unknown }).llm) },
    _source: "db" as const,
  };
}
