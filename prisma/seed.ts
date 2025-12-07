import { prisma } from '../src/lib/prisma';

async function main() {
  await prisma.user.upsert({
    where: { id: 'charlie' },
    update: {
      email: 'charlie@strategicsystems.io',
      name: 'Charlie Hall',
      role: 'RECRUITER',
    },
    create: {
      id: 'charlie',
      email: 'charlie@strategicsystems.io',
      name: 'Charlie Hall',
      role: 'RECRUITER',
    },
  });
}

main()
  .then(() => console.log('Seeded'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
