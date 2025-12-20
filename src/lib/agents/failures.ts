import { AgentRunStatus } from "@/server/db/prisma";

import { prisma } from "@/server/db/prisma";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function getAgentFailureCount(tenantId: string, windowMs = TWENTY_FOUR_HOURS_MS) {
  if (!tenantId?.trim()) {
    return 0;
  }

  const startedAfter = new Date(Date.now() - windowMs);

  const failedRuns = await prisma.agentRunLog.count({
    where: {
      tenantId,
      status: AgentRunStatus.FAILED,
      deletedAt: null,
      startedAt: { gte: startedAfter },
    },
  });

  return failedRuns;
}
