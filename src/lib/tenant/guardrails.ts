import "server-only";

import { Prisma } from "@prisma/client";

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

function extractMissingColumns(error: unknown) {
  const candidates = new Set<string>();
  const meta = (error as { meta?: unknown } | null | undefined)?.meta as
    | { target?: string | string[] }
    | undefined;

  const target = meta?.target;

  if (typeof target === "string") {
    candidates.add(target);
  } else if (Array.isArray(target)) {
    target.forEach((value) => candidates.add(String(value)));
  }

  const message = (error as Error | null | undefined)?.message ?? "";
  const columnRegex = /column "([^"]+)"/gi;
  let match: RegExpExecArray | null;

  while ((match = columnRegex.exec(message))) {
    candidates.add(match[1]);
  }

  return Array.from(candidates);
}

export type TenantConfigSchemaStatus = {
  status: "ok" | "fallback";
  missingColumns: string[];
  reason: string | null;
};

async function ensureTenantConfigPresetColumn(): Promise<TenantConfigSchemaStatus> {
  const [{ exists } = { exists: false }] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'TenantConfig'
        AND column_name = 'preset'
    ) as "exists";
  `;

  if (exists) return { status: "ok", missingColumns: [], reason: null };

  try {
    await prisma.$executeRaw`ALTER TABLE "TenantConfig" ADD COLUMN "preset" TEXT`;
    console.info("Added missing TenantConfig.preset column to align guardrail lookups.");
    return { status: "ok", missingColumns: [], reason: null };
  } catch (error) {
    console.error("Failed to add TenantConfig.preset column", error);
    return {
      status: "fallback",
      missingColumns: ["preset"],
      reason: "TenantConfig.preset column is missing or could not be added.",
    } satisfies TenantConfigSchemaStatus;
  }
}

async function ensureTenantConfigSchema(): Promise<TenantConfigSchemaStatus> {
  if (!(await isTableAvailable("TenantConfig"))) {
    return {
      status: "fallback",
      missingColumns: [],
      reason: "TenantConfig table is missing; using default guardrails.",
    } satisfies TenantConfigSchemaStatus;
  }

  return ensureTenantConfigPresetColumn();
}

async function loadTenantGuardrailsInternal(tenantId: string) {
  const schemaStatus = await ensureTenantConfigSchema();

  if (schemaStatus.status === "fallback") {
    return { guardrails: defaultTenantGuardrails, schemaStatus } as const;
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
    return { guardrails: mergeGuardrails(stored), schemaStatus: { status: "ok", missingColumns: [], reason: null } } as const;
  } catch (error) {
    const missingColumns = extractMissingColumns(error);
    console.error("Invalid guardrails config detected, using defaults", error);
    return {
      guardrails: defaultTenantGuardrails,
      schemaStatus: {
        status: "fallback",
        missingColumns,
        reason:
          missingColumns.length > 0
            ? `Guardrails config schema mismatch; missing columns: ${missingColumns.join(", ")}.`
            : "Guardrails config could not be parsed; using defaults instead.",
      },
    } as const;
  }
}

export async function loadTenantGuardrailsWithSchemaStatus(tenantId: string) {
  try {
    return await loadTenantGuardrailsInternal(tenantId);
  } catch (error) {
    const missingColumns = extractMissingColumns(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && isPrismaUnavailableError(error)) {
      throw error;
    }

    console.error("Unable to load tenant guardrails; using defaults", error);
    return {
      guardrails: defaultTenantGuardrails,
      schemaStatus: {
        status: "fallback",
        missingColumns,
        reason:
          missingColumns.length > 0
            ? `TenantConfig schema mismatch; missing columns: ${missingColumns.join(", ")}.`
            : "TenantConfig schema mismatch detected; using default guardrails.",
      },
    } as const;
  }
}

export async function loadTenantGuardrails(tenantId: string): Promise<TenantGuardrails> {
  const { guardrails } = await loadTenantGuardrailsWithSchemaStatus(tenantId);

  return guardrails;
}

export async function saveTenantGuardrails(
  tenantId: string,
  payload: unknown,
): Promise<{ saved: TenantGuardrails; created: boolean }>
export async function saveTenantGuardrails(tenantId: string, payload: unknown) {
  const parsed = guardrailsSchema.parse(payload);

  const schemaStatus = await ensureTenantConfigSchema();

  if (schemaStatus.status === "fallback") {
    throw new Error(schemaStatus.reason ?? "TenantConfig table is unavailable");
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
