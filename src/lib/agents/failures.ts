import { AgentRunStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getAgentFailureCount(tenantId: string) {
  if (!tenantId?.trim()) {
    return 0;
  }

  const failedRuns = await prisma.agentRunLog.count({
    where: { tenantId, status: AgentRunStatus.FAILED, deletedAt: null },
  });

  return failedRuns;
}
