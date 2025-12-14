import { prisma } from "../src/server/db";

import { DEFAULT_TENANT_ID } from "../src/lib/auth/config";
import { seedDemoTenant } from "./demoSeed";

async function main() {
  await seedDemoTenant(prisma, {
    tenantId: DEFAULT_TENANT_ID,
    tenantName: 'Default Tenant',
    tenantMode: 'demo',
    systemMode: 'demo',
    resetTenantData: true,
  });
}

main()
  .then(() => console.log('Seeded'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
