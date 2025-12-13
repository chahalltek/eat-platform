import { PrismaClient } from '@prisma/client';

import { seedDemoTenant } from '../prisma/demoSeed';

const prisma = new PrismaClient();
const DEMO_TENANT_ID = 'demo-tenant';

async function main() {
  await seedDemoTenant(prisma, {
    tenantId: DEMO_TENANT_ID,
    tenantName: 'Demo Tenant',
    tenantMode: 'demo',
    systemMode: 'demo',
    resetTenantData: true,
  });

  console.log('Seeded demo tenant', DEMO_TENANT_ID);
}

main()
  .catch((error) => {
    console.error('Failed to seed demo tenant', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
