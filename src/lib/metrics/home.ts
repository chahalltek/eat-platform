import { AgentRunStatus } from "@prisma/client";

import { listAgentKillSwitches } from "@/lib/agents/killSwitch";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export type HomeTelemetryMetrics = {
  agentsOnline: number | null;
  agentsExecutedToday: number | null;
  incidentsLast24h: number | null;
};

export type HomeCardMetrics = {
  totalJobs: number | null;
  totalCandidates: number | null;
  testContentRoles: number | null;
  agentRunsLast7d: number | null;
<<<<<<< ours
  telemetry: HomeTelemetryMetrics;
=======
  lastAgentRunAt: string | null;
  failedAgentRunsLast7d: number | null;
>>>>>>> theirs
};

export async function getHomeCardMetrics(): Promise<HomeCardMetrics> {
  const tenantId = await getCurrentTenantId();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const oneWeekAgo = new Date();
  oneWeekAgo.setHours(0, 0, 0, 0);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

  try {
    const [
      totalJobs,
      totalCandidates,
      testContentRoles,
      agentRunsLast7d,
<<<<<<< ours
      agentsExecutedToday,
      incidentsLast24h,
      killSwitches,
=======
      latestRun,
      failedAgentRunsLast7d,
>>>>>>> theirs
    ] = await Promise.all([
      prisma.jobReq.count({ where: { tenantId } }),
      prisma.candidate.count({ where: { tenantId } }),
      prisma.jobReq.count({ where: { tenantId, sourceType: "Test Content" } }),
      prisma.agentRunLog.count({ where: { tenantId, startedAt: { gte: oneWeekAgo } } }),
<<<<<<< ours
      prisma.agentRunLog.count({ where: { tenantId, startedAt: { gte: startOfToday } } }),
      prisma.agentRunLog.count({
        where: { tenantId, status: AgentRunStatus.FAILED, startedAt: { gte: oneDayAgo } },
      }),
      listAgentKillSwitches(),
    ]);

    const agentsOnline = killSwitches.filter((agent) => !agent.latched).length;

=======
      prisma.agentRunLog.findFirst({
        where: { tenantId, startedAt: { gte: oneWeekAgo } },
        select: { startedAt: true },
        orderBy: { startedAt: "desc" },
      }),
      prisma.agentRunLog.count({
        where: { tenantId, startedAt: { gte: oneWeekAgo }, status: "FAILED" },
      }),
    ]);

>>>>>>> theirs
    return {
      totalJobs,
      totalCandidates,
      testContentRoles,
      agentRunsLast7d,
<<<<<<< ours
      telemetry: { agentsOnline, agentsExecutedToday, incidentsLast24h },
=======
      lastAgentRunAt: latestRun?.startedAt?.toISOString() ?? null,
      failedAgentRunsLast7d,
>>>>>>> theirs
    };
  } catch (error) {
    console.error("[Home] Failed to load card metrics", error);
    return {
      totalJobs: null,
      totalCandidates: null,
      testContentRoles: null,
      agentRunsLast7d: null,
<<<<<<< ours
      telemetry: { agentsOnline: null, agentsExecutedToday: null, incidentsLast24h: null },
=======
      lastAgentRunAt: null,
      failedAgentRunsLast7d: null,
>>>>>>> theirs
    };
  }
}
