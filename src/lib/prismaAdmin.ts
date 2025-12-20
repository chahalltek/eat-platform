import { createPrismaClient, PrismaClient } from '@/server/db/prisma';

const globalForPrisma = globalThis as unknown as {
  prismaAdmin?: PrismaClient;
};

const prismaAdminClient =
  globalForPrisma.prismaAdmin ??
  createPrismaClient();

export const prismaAdmin = prismaAdminClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaAdmin = prismaAdmin;
}
