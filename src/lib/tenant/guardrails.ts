import "server-only";

import { isPrismaUnavailableError, isTableAvailable, prisma } from "@/server/db";
import { withTenantConfigSchemaFallback } from "./tenantConfigSchemaFallback";

import {
  defaultTenantGuardrails,
  guardrailsSchema,
  mergeGuardrails,
  type PartialTenantGuardrails,
  type TenantGuardrails,
} from "./guardrails.shared";

export { guardrailsSchema, defaultTenantGuardrails, type TenantGuardrails } from "./guardrails.shared";

async function ensureTenantConfigPresetColumn() {
  const [{ exists } = { exists: false }] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'TenantConfig'
        AND column_name = 'preset'
    ) as "exists";
  `;

  if (exists) return true;

  try {
    await prisma.$executeRaw`ALTER TABLE "TenantConfig" ADD COLUMN "preset" TEXT`;
    console.info("Added missing TenantConfig.preset column to align guardrail lookups.");
    return true;
  } catch (error) {
    console.error("Failed to add TenantConfig.preset column", error);
    return false;
  }
}

async function ensureTenantConfigTable() {
  if (!(await isTableAvailable("TenantConfig"))) {
    return false;
  }

  return ensureTenantConfigPresetColumn();
}

export async function loadTenantGuardrails(tenantId: string): Promise<TenantGuardrails> {
  if (!(await ensureTenantConfigTable())) {
    return defaultTenantGuardrails;
  }

  const record = await withTenantConfigSchemaFallback(
    () => prisma.tenantConfig.findFirst({ where: { tenantId } }),
    { tenantId },
  ).catch((error) => {
    if (isPrismaUnavailableError(error)) return null;

    throw error;
  });

  const storedGuardrails =
    ((record as { guardrails?: unknown } | null | undefined)?.guardrails as
      | PartialTenantGuardrails
      | null
      | undefined) ?? null;

  const stored =
    storedGuardrails ??
    (record
      ? {
          preset: (record as { preset?: TenantGuardrails["preset"] }).preset,
          scoring: record.scoring as Partial<TenantGuardrails["scoring"]> | undefined,
          explain: record.explain as Partial<TenantGuardrails["explain"]> | undefined,
          safety: record.safety as Partial<TenantGuardrails["safety"]> | undefined,
          llm: (record as { llm?: Partial<TenantGuardrails["llm"]> }).llm,
          networkLearning: (record as { networkLearning?: Partial<TenantGuardrails["networkLearning"]> }).networkLearning,
        }
      : null);
  try {
    return mergeGuardrails(stored);
  } catch (error) {
    console.error("Invalid guardrails config detected, using defaults", error);
    return defaultTenantGuardrails;
  }
}

export async function saveTenantGuardrails(
  tenantId: string,
  payload: unknown,
): Promise<{ saved: TenantGuardrails; created: boolean }>
export async function saveTenantGuardrails(tenantId: string, payload: unknown) {
  const parsed = guardrailsSchema.parse(payload);

  if (!(await ensureTenantConfigTable())) {
    throw new Error("TenantConfig table is unavailable");
  }

  const existing = await prisma.tenantConfig.findFirst({ where: { tenantId } });

  await prisma.tenantConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      preset: parsed.preset,
      scoring: parsed.scoring,
      explain: parsed.explain,
      safety: parsed.safety,
      llm: parsed.llm,
      networkLearning: parsed.networkLearning,
    },
    update: {
      preset: parsed.preset,
      scoring: parsed.scoring,
      explain: parsed.explain,
      safety: parsed.safety,
      llm: parsed.llm,
      networkLearning: parsed.networkLearning,
    },
  });

  return { saved: parsed, created: !existing };
}
