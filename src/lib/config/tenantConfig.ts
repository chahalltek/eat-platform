import { TS_CONFIG, type TsConfig } from "@/config/ts";
import { prisma } from "@/server/db";

export type TenantConfig = TsConfig;

export const DEFAULT_TENANT_CONFIG: TenantConfig = TS_CONFIG;

type TenantClient = Pick<typeof prisma, "tenant">;

function isTenantClient(client: unknown): client is TenantClient {
  return Boolean((client as TenantClient | null)?.tenant?.findUnique);
}

export async function loadTenantConfig(
  tenantId?: string | null,
  client: TenantClient | null = prisma,
): Promise<TenantConfig> {
  if (!tenantId || !tenantId.trim()) {
    return DEFAULT_TENANT_CONFIG;
  }

  if (!isTenantClient(client)) {
    return DEFAULT_TENANT_CONFIG;
  }

  try {
    const tenant = await client.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant) {
      return DEFAULT_TENANT_CONFIG;
    }

    return DEFAULT_TENANT_CONFIG;
  } catch (error) {
    console.warn("Falling back to default tenant config", error);
    return DEFAULT_TENANT_CONFIG;
  }
}
