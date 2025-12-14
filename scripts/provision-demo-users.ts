import { prisma } from "../src/server/db";

import { DEFAULT_TENANT_ID } from "../src/lib/auth/config";

const DEMO_USERS = [
  {
    email: 'admin@test.demo',
    displayName: 'Admin',
    role: 'ADMIN',
  },
  {
    email: 'recruiter@test.demo',
    displayName: 'Recruiter',
    role: 'RECRUITER',
  },
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { name: 'Default Tenant', status: 'active' },
    create: { id: DEFAULT_TENANT_ID, name: 'Default Tenant', status: 'active' },
  });

  for (const user of DEMO_USERS) {
    const record = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: user.email } },
      update: { ...user, tenantId: tenant.id },
      create: { ...user, tenantId: tenant.id },
    });

    // Create a basic identity record to mirror the local login convention.
    await prisma.userIdentity.upsert({
      where: {
        provider_subject: {
          provider: 'local',
          subject: record.email,
        },
      },
      update: { userId: record.id },
      create: {
        userId: record.id,
        provider: 'local',
        subject: record.email,
      },
    });

    await prisma.tenantUser.upsert({
      where: {
        userId_tenantId: {
          userId: record.id,
          tenantId: tenant.id,
        },
      },
      update: { role: user.role },
      create: { userId: record.id, tenantId: tenant.id, role: user.role },
    });
  }

  console.log('Provisioned demo users for tenant', tenant.id);
  console.log('Accounts:');
  DEMO_USERS.forEach(({ email }) => {
    console.log(`- ${email}`);
  });
}

main()
  .catch((error) => {
    console.error('Failed to provision demo users:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
