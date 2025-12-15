import { Prisma } from "@prisma/client";

type FallbackContext = {
  tenantId?: string;
};

let hasLoggedTenantConfigSchemaMismatch = false;

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
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      logTenantConfigSchemaMismatch(context, error);
      return null;
    }

    throw error;
  }
}

export function resetTenantConfigSchemaFallbackForTests() {
  hasLoggedTenantConfigSchemaMismatch = false;
}
