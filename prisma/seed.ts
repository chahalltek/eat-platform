import { prisma } from '../src/lib/prisma';

async function main() {
  await prisma.user.upsert({
    where: { id: "charlie" },
    update: {},
    create: {
      id: "charlie",
      email: "chall@strsi.com",
      name: "Charlie Hall",
      role: "RECRUITER"
    }
  });
}

main()
  .then(() => console.log('Seeded'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
