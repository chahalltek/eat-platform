import { prisma } from "@/lib/prisma";
import { defaultTenantGuardrails } from "./defaultTenantConfig";

function coerceGuardrailSection(value: unknown) {
  return value && typeof value === "object" ? value : {};
}

export async function loadTenantConfig(tenantId: string) {
  const existing = await prisma.tenantConfig.findUnique({
    where: { tenantId },
  });

  if (!existing) {
    return {
      ...defaultTenantGuardrails,
      _source: "default" as const,
    };
  }

  return {
    scoring: { ...defaultTenantGuardrails.scoring, ...coerceGuardrailSection(existing.scoring) },
    explain: { ...defaultTenantGuardrails.explain, ...coerceGuardrailSection(existing.explain) },
    safety: { ...defaultTenantGuardrails.safety, ...coerceGuardrailSection(existing.safety) },
    _source: "db" as const,
  };
}
