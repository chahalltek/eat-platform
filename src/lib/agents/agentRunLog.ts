import type { Prisma, PrismaClient, UsageEventType } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/user";
import { recordUsageEvent } from "@/lib/usage/events";

export async function createAgentRunLog(
  prisma: PrismaClient,
  data: Omit<Prisma.AgentRunLogUncheckedCreateInput, "userId">,
) {
  const user = await getCurrentUser();

  if (!user?.id) {
    throw new Error("Agent run log creation requires an authenticated user");
  }

  const run = await prisma.agentRunLog.create({
    data: {
      ...data,
      userId: user.id,
    },
  });

  void recordUsageEvent({
    tenantId: data.tenantId,
    eventType: "AGENT_RUN" as UsageEventType,
  });

  return run;
}
