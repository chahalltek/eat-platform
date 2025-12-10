import { AgentRunStatus } from '@prisma/client';

import { AGENT_KILL_SWITCHES, describeAgentKillSwitch, listAgentKillSwitches } from '@/lib/agents/killSwitch';
import { prisma } from '@/lib/prisma';

export type AgentStatusHealth = 'healthy' | 'warning' | 'error' | 'unknown';

export type AgentStatusDescriptor = {
  agentName: string;
  label: string;
  status: AgentStatusHealth;
  statusDetail: string;
  lastRunAt: string | null;
  lastRunStatus: AgentRunStatus | 'UNKNOWN';
  lastRunDurationMs: number | null;
  lastErrorMessage: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  killSwitchLatched: boolean;
  killSwitchReason: string | null;
  failureCount24h: number;
};

export type AgentsStatusPayload = {
  generatedAt: string;
  agents: AgentStatusDescriptor[];
};

type RecentRun = {
  agentName: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: AgentRunStatus;
  errorMessage: string | null;
  durationMs: number | null;
};

function buildFallback(agentName: string): AgentStatusDescriptor {
  return {
    agentName,
    label: describeAgentKillSwitch(agentName as (typeof AGENT_KILL_SWITCHES)[keyof typeof AGENT_KILL_SWITCHES]),
    status: 'unknown',
    statusDetail: 'Status unavailable',
    lastRunAt: null,
    lastRunStatus: 'UNKNOWN',
    lastRunDurationMs: null,
    lastErrorMessage: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    killSwitchLatched: false,
    killSwitchReason: null,
    failureCount24h: 0,
  } satisfies AgentStatusDescriptor;
}

function deriveStatus(entry: AgentStatusDescriptor): Pick<AgentStatusDescriptor, 'status' | 'statusDetail'> {
  if (entry.killSwitchLatched) {
    return { status: 'error', statusDetail: entry.killSwitchReason ?? 'Disabled via kill switch' };
  }

  if (!entry.lastRunAt) {
    return { status: 'warning', statusDetail: 'No runs recorded yet' };
  }

  if (entry.lastRunStatus === AgentRunStatus.FAILED) {
    return { status: 'error', statusDetail: 'Last run failed' };
  }

  if (entry.failureCount24h > 0) {
    return { status: 'warning', statusDetail: `${entry.failureCount24h} failure(s) in last 24h` };
  }

  return { status: 'healthy', statusDetail: 'Operational' };
}

function normalizeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function buildDescriptor(
  agentName: string,
  recentRuns: RecentRun[],
  failureCount: number,
  killSwitchState: { latched: boolean; reason: string | null },
): AgentStatusDescriptor {
  const lastRun = recentRuns.find((run) => run.agentName === agentName) ?? null;
  const lastSuccess = recentRuns.find((run) => run.agentName === agentName && run.status === AgentRunStatus.SUCCESS) ?? null;
  const lastFailure = recentRuns.find((run) => run.agentName === agentName && run.status === AgentRunStatus.FAILED) ?? null;

  const base: AgentStatusDescriptor = {
    agentName,
    label: describeAgentKillSwitch(agentName as (typeof AGENT_KILL_SWITCHES)[keyof typeof AGENT_KILL_SWITCHES]),
    status: 'unknown',
    statusDetail: 'Status unavailable',
    lastRunAt: normalizeDate(lastRun?.startedAt ?? null),
    lastRunStatus: lastRun?.status ?? 'UNKNOWN',
    lastRunDurationMs: lastRun?.durationMs ?? null,
    lastErrorMessage: lastRun?.errorMessage ?? null,
    lastSuccessAt: normalizeDate(lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null),
    lastFailureAt: normalizeDate(lastFailure?.finishedAt ?? lastFailure?.startedAt ?? null),
    killSwitchLatched: killSwitchState.latched,
    killSwitchReason: killSwitchState.reason,
    failureCount24h: failureCount,
  } satisfies AgentStatusDescriptor;

  const derived = deriveStatus(base);

  return { ...base, ...derived } satisfies AgentStatusDescriptor;
}

export async function getAgentsStatus(): Promise<AgentsStatusPayload> {
  const agentNames = Object.values(AGENT_KILL_SWITCHES);

  try {
    const since24h = new Date();
    since24h.setHours(since24h.getHours() - 24);

    const [killSwitches, recentRuns, failureCounts] = await Promise.all([
      listAgentKillSwitches(),
      prisma.agentRunLog.findMany({
        where: { agentName: { in: agentNames }, deletedAt: null },
        orderBy: { startedAt: 'desc' },
        take: agentNames.length * 10,
        select: {
          agentName: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          errorMessage: true,
          durationMs: true,
        },
      }),
      prisma.agentRunLog.groupBy({
        by: ['agentName'],
        where: { agentName: { in: agentNames }, status: AgentRunStatus.FAILED, startedAt: { gte: since24h } },
        _count: { _all: true },
      }),
    ]);

    const failureCountMap = new Map<string, number>(failureCounts.map((entry) => [entry.agentName, entry._count._all]));
    const killSwitchMap = new Map<string, { latched: boolean; reason: string | null }>(
      killSwitches.map((entry) => [entry.agentName, { latched: entry.latched, reason: entry.reason ?? null }]),
    );

    const agents: AgentStatusDescriptor[] = agentNames.map((agentName) =>
      buildDescriptor(
        agentName,
        recentRuns as RecentRun[],
        failureCountMap.get(agentName) ?? 0,
        killSwitchMap.get(agentName) ?? { latched: false, reason: null },
      ),
    );

    return { agents, generatedAt: new Date().toISOString() } satisfies AgentsStatusPayload;
  } catch (error) {
    console.error('[agents-status-board] failed to build status payload', error);

    return {
      generatedAt: new Date().toISOString(),
      agents: agentNames.map((agentName) => buildFallback(agentName)),
    } satisfies AgentsStatusPayload;
  }
}
