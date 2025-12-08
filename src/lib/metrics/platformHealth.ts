import { AgentRunStatus } from "@prisma/client";

import { describeKillSwitch, getKillSwitchState, KILL_SWITCHES, type KillSwitchName, type KillSwitchState } from "@/lib/killSwitch";
import { prisma } from "@/lib/prisma";
import { USER_ROLES } from "@/lib/auth/roles";

export type PlatformHealthSnapshot = {
  agents: {
    totalAgents: number;
    totalPrompts: number;
    activePrompts: number;
    latestPromptUpdate: Date | null;
    busiestAgents: { agentName: string; runs: number }[];
  };
  runs: {
    last24h: number;
    runningNow: number;
    successRate: number;
    averageDurationMs: number | null;
  };
  errors: {
    last24h: number;
    last7d: number;
    topByAgent: { agentName: string; count: number }[];
  };
  users: {
    total: number;
    admins: number;
    newThisMonth: number;
    activeLastWeek: number;
  };
  database: {
    tables: { label: string; count: number }[];
  };
  killSwitches: { name: KillSwitchName; label: string; state: KillSwitchState }[];
};

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function getPlatformHealthSnapshot(): Promise<PlatformHealthSnapshot> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    agentNames,
    totalPrompts,
    activePrompts,
    latestPrompt,
    runsLastDay,
    successesLastDay,
    failuresLastDay,
    runningNow,
    durationAverage,
    failedRunsWeek,
    busiestAgents,
    totalUsers,
    adminUsers,
    newUsers,
    activeUsers,
    candidateCount,
    jobReqCount,
    matchCount,
    outreachCount,
    tenantCount,
  ] = await Promise.all([
    prisma.agentPrompt.findMany({ distinct: ["agentName"], select: { agentName: true } }),
    prisma.agentPrompt.count(),
    prisma.agentPrompt.count({ where: { active: true } }),
    prisma.agentPrompt.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.agentRunLog.count({ where: { startedAt: { gte: oneDayAgo } } }),
    prisma.agentRunLog.count({ where: { startedAt: { gte: oneDayAgo }, status: AgentRunStatus.SUCCESS } }),
    prisma.agentRunLog.count({ where: { startedAt: { gte: oneDayAgo }, status: AgentRunStatus.FAILED } }),
    prisma.agentRunLog.count({ where: { status: AgentRunStatus.RUNNING, finishedAt: null } }),
    prisma.agentRunLog.aggregate({ _avg: { durationMs: true }, where: { finishedAt: { gte: oneDayAgo }, durationMs: { not: null } } }),
    prisma.agentRunLog.groupBy({
      by: ["agentName"],
      where: { startedAt: { gte: oneWeekAgo }, status: AgentRunStatus.FAILED },
      _count: { _all: true },
    }),
    prisma.agentRunLog.groupBy({
      by: ["agentName"],
      where: { startedAt: { gte: oneWeekAgo } },
      _count: { _all: true },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { role: { in: [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN] } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth(now) } } }),
    prisma.agentRunLog.findMany({
      where: { startedAt: { gte: oneWeekAgo }, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.candidate.count(),
    prisma.jobReq.count(),
    prisma.matchResult.count(),
    prisma.outreachInteraction.count(),
    prisma.tenant.count(),
  ]);

  const totalRunsForRate = successesLastDay + failuresLastDay;
  const successRate = totalRunsForRate === 0 ? 0 : Math.round((successesLastDay / totalRunsForRate) * 100);

  const topErrorsByAgent = failedRunsWeek
    .map((item) => ({ agentName: item.agentName, count: item._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const busiestAgentsList = busiestAgents
    .map((item) => ({ agentName: item.agentName, runs: item._count._all }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5);

  const killSwitches = Object.values(KILL_SWITCHES).map((name) => ({
    name,
    label: describeKillSwitch(name),
    state: getKillSwitchState(name),
  }));

  return {
    agents: {
      totalAgents: agentNames.length,
      totalPrompts,
      activePrompts,
      latestPromptUpdate: latestPrompt?.updatedAt ?? null,
      busiestAgents: busiestAgentsList,
    },
    runs: {
      last24h: runsLastDay,
      runningNow,
      successRate,
      averageDurationMs: durationAverage._avg.durationMs ? Math.round(durationAverage._avg.durationMs) : null,
    },
    errors: {
      last24h: failuresLastDay,
      last7d: failedRunsWeek.reduce((sum, item) => sum + item._count._all, 0),
      topByAgent: topErrorsByAgent,
    },
    users: {
      total: totalUsers,
      admins: adminUsers,
      newThisMonth: newUsers,
      activeLastWeek: activeUsers.length,
    },
    database: {
      tables: [
        { label: "Tenants", count: tenantCount },
        { label: "Candidates", count: candidateCount },
        { label: "Job Reqs", count: jobReqCount },
        { label: "Matches", count: matchCount },
        { label: "Outreach", count: outreachCount },
      ],
    },
    killSwitches,
  };
}
