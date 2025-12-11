import { prisma } from "@/lib/prisma";
import { defaultTenantGuardrails } from "./defaultTenantConfig";

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
    scoring: { ...defaultTenantGuardrails.scoring, ...existing.scoring },
    explain: { ...defaultTenantGuardrails.explain, ...existing.explain },
    safety: { ...defaultTenantGuardrails.safety, ...existing.safety },
    _source: "db" as const,
  };
}
