import { AgentRunStatus, Prisma } from "@/server/db";

import { listAgentKillSwitches } from "@/lib/agents/killSwitch";
import { prisma } from "@/server/db";
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
  lastAgentRunAt: string | null;
  failedAgentRunsLast7d: number | null;
};

async function getTestContentRolesCount(tenantId: string) {
  try {
    return await prisma.jobReq.count({ where: { tenantId, sourceType: "Test Content" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      console.warn("[Home] jobReq.sourceType column missing; skipping test content count");
      return null;
    }

    throw error;
  }
}

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
      latestRun,
      failedAgentRunsLast7d,
    ] = await Promise.all([
      prisma.jobReq.count({ where: { tenantId } }),
      prisma.candidate.count({ where: { tenantId } }),
      getTestContentRolesCount(tenantId),
      prisma.agentRunLog.count({ where: { tenantId, startedAt: { gte: oneWeekAgo } } }),
      prisma.agentRunLog.count({ where: { tenantId, startedAt: { gte: startOfToday } } }),
      prisma.agentRunLog.count({
        where: { tenantId, status: AgentRunStatus.FAILED, startedAt: { gte: oneDayAgo } },
      }),
      listAgentKillSwitches(),
      prisma.agentRunLog.findFirst({
        where: { tenantId, startedAt: { gte: oneWeekAgo } },
        select: { startedAt: true },
        orderBy: { startedAt: "desc" },
      }),
      prisma.agentRunLog.count({
        where: { tenantId, startedAt: { gte: oneWeekAgo }, status: "FAILED" },
      }),
    ]);

    return {
      totalJobs,
      totalCandidates,
      testContentRoles,
      agentRunsLast7d,
      telemetry: {
        agentsOnline: killSwitches.filter((agent) => !agent.latched).length,
        agentsExecutedToday,
        incidentsLast24h,
      },
      lastAgentRunAt: latestRun?.startedAt?.toISOString() ?? null,
      failedAgentRunsLast7d,
    };
  } catch (error) {
    console.error("[Home] Failed to load card metrics", error);
    return {
      totalJobs: null,
      totalCandidates: null,
      testContentRoles: null,
      agentRunsLast7d: null,
      telemetry: { agentsOnline: null, agentsExecutedToday: null, incidentsLast24h: null },
      lastAgentRunAt: null,
      failedAgentRunsLast7d: null,
    };
  }
}
