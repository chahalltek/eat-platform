import { Prisma } from "@prisma/client";

type FallbackContext = {
  tenantId?: string;
};

export type TenantConfigSchemaFallbackResult<T> = {
  result: T | null;
  schemaMismatch: boolean;
  reason?: string;
};

let hasLoggedTenantConfigSchemaMismatch = false;
let hasTenantConfigSchemaMismatch = false;

function logTenantConfigSchemaMismatch({ tenantId }: FallbackContext, error: Prisma.PrismaClientKnownRequestError) {
  if (hasLoggedTenantConfigSchemaMismatch) return;

  hasLoggedTenantConfigSchemaMismatch = true;

  console.warn({
    event: "tenant_config_schema_mismatch",
    message:
      "TenantConfig column missing (likely preset). Run prisma migrations to align the database schema.",
    tenantId: tenantId ?? null,
    meta: error.meta,
  });
}

export async function withTenantConfigSchemaFallback<T>(
  operation: () => Promise<T>,
  context: FallbackContext,
): Promise<TenantConfigSchemaFallbackResult<T>> {
  try {
    const result = await operation();
    hasTenantConfigSchemaMismatch = false;
    return { result, schemaMismatch: false } satisfies TenantConfigSchemaFallbackResult<T>;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      hasTenantConfigSchemaMismatch = true;
      logTenantConfigSchemaMismatch(context, error);
      return {
        result: null,
        schemaMismatch: true,
        reason:
          "TenantConfig column missing (likely preset). Run prisma migrations to align the database schema.",
      } satisfies TenantConfigSchemaFallbackResult<T>;
    }

    hasTenantConfigSchemaMismatch = false;
    throw error;
  }
}

export function resetTenantConfigSchemaFallbackForTests() {
  hasLoggedTenantConfigSchemaMismatch = false;
  hasTenantConfigSchemaMismatch = false;
}

export function tenantConfigSchemaMismatchDetected() {
  return hasTenantConfigSchemaMismatch;
}
