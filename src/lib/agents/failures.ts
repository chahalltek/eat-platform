import { AgentRunStatus } from "@/server/db";

import { prisma } from "@/server/db";

export async function getAgentFailureCount(tenantId: string) {
  if (!tenantId?.trim()) {
    return 0;
  }

  const failedRuns = await prisma.agentRunLog.count({
    where: { tenantId, status: AgentRunStatus.FAILED, deletedAt: null },
  });

  return failedRuns;
}
