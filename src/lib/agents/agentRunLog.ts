import type { Prisma, PrismaClient } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/user";

export async function createAgentRunLog(
  prisma: PrismaClient,
  data: Omit<Prisma.AgentRunLogUncheckedCreateInput, "userId">,
) {
  const user = await getCurrentUser();

  if (!user?.id) {
    throw new Error("Agent run log creation requires an authenticated user");
  }

  return prisma.agentRunLog.create({
    data: {
      ...data,
      userId: user.id,
    },
  });
}
