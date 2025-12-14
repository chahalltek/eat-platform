import type { Prisma, PrismaClient, UsageEventType } from "@/server/db";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { recordUsageEvent } from "@/lib/usage/events";

export async function createAgentRunLog(
  prisma: PrismaClient,
  data: Omit<Prisma.AgentRunLogUncheckedCreateInput, "userId">,
  resolvedUser?: { id: string | null | undefined; tenantId?: string | null | undefined },
) {
  const user = resolvedUser?.id ? resolvedUser : await getCurrentUser();

  if (!user?.id) {
    throw new Error("Agent run log creation requires an authenticated user");
  }

  const tenantId = data.tenantId ?? user.tenantId ?? DEFAULT_TENANT_ID;

  const run = await prisma.agentRunLog.create({
    data: {
      ...data,
      tenantId,
      userId: user.id,
    },
  });

  void recordUsageEvent({
    tenantId,
    eventType: "AGENT_RUN" as UsageEventType,
  });

  return run;
}
