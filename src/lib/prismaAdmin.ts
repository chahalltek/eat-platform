import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prismaAdmin?: PrismaClient;
};

const prismaAdminClient =
  globalForPrisma.prismaAdmin ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

export const prismaAdmin = prismaAdminClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaAdmin = prismaAdmin;
}
