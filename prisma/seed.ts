import { prisma } from '../src/lib/prisma';

async function main() {
  await prisma.user.upsert({
    where: { id: 'charlie' },
    update: {
      email: 'charlie@strategicsystems.io',
      displayName: 'Charlie Hall',
      role: 'RECRUITER',
    },
    create: {
      id: 'charlie',
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
    },
    create: {
      id: 'admin',
      email: 'admin@strategicsystems.io',
      displayName: 'Platform Admin',
      role: 'ADMIN',
    },
  });
}

main()
  .then(() => console.log('Seeded'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
