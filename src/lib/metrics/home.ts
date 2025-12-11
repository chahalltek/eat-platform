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
  telemetry: HomeTelemetryMetrics;
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
      agentsExecutedToday,
      incidentsLast24h,
      killSwitches,
    ] = await Promise.all([
      prisma.jobReq.count({ where: { tenantId } }),
      prisma.candidate.count({ where: { tenantId } }),
      prisma.jobReq.count({ where: { tenantId, sourceType: "Test Content" } }),
      prisma.agentRunLog.count({ where: { tenantId, startedAt: { gte: oneWeekAgo } } }),
      prisma.agentRunLog.count({ where: { tenantId, startedAt: { gte: startOfToday } } }),
      prisma.agentRunLog.count({
        where: { tenantId, status: AgentRunStatus.FAILED, startedAt: { gte: oneDayAgo } },
      }),
      listAgentKillSwitches(),
    ]);

    const agentsOnline = killSwitches.filter((agent) => !agent.latched).length;

    return {
      totalJobs,
      totalCandidates,
      testContentRoles,
      agentRunsLast7d,
      telemetry: { agentsOnline, agentsExecutedToday, incidentsLast24h },
    };
  } catch (error) {
    console.error("[Home] Failed to load card metrics", error);
    return {
      totalJobs: null,
      totalCandidates: null,
      testContentRoles: null,
      agentRunsLast7d: null,
      telemetry: { agentsOnline: null, agentsExecutedToday: null, incidentsLast24h: null },
    };
  }
}
