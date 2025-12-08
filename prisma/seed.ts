import { DEFAULT_TENANT_ID } from '../src/lib/auth/config';
import { prisma } from '../src/lib/prisma';
import { FEATURE_FLAGS, setFeatureFlag } from '../src/lib/featureFlags';

async function main() {
  await prisma.user.upsert({
    where: { id: 'charlie' },
    update: {
      email: 'charlie@strategicsystems.io',
      displayName: 'Charlie Hall',
      role: 'RECRUITER',
      tenantId: DEFAULT_TENANT_ID,
    },
    create: {
      id: 'charlie',
      tenantId: DEFAULT_TENANT_ID,
      email: 'charlie@strategicsystems.io',
      displayName: 'Charlie Hall',
      role: 'RECRUITER',
    },
  });

  await prisma.user.upsert({
    where: { id: 'admin' },
    update: {
      email: 'admin@strategicsystems.io',
      displayName: 'Platform Admin',
      role: 'ADMIN',
      tenantId: DEFAULT_TENANT_ID,
    },
    create: {
      id: 'admin',
      tenantId: DEFAULT_TENANT_ID,
      email: 'admin@strategicsystems.io',
      displayName: 'Platform Admin',
      role: 'ADMIN',
    },
  });

  await Promise.all(
    Object.values(FEATURE_FLAGS).map((flagName) => setFeatureFlag(flagName, false)),
  );
}

main()
  .then(() => console.log('Seeded'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
