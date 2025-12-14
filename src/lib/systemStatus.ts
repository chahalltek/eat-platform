import { AgentRunStatus } from '@/server/db';

import { FEATURE_FLAGS, isFeatureEnabled } from './featureFlags';
import { isPrismaUnavailableError, isTableAvailable, prisma } from './prisma';
import { loadTenantGuardrailConfig } from './guardrails/config';
import { getCurrentTenantId } from './tenant';
import { getSystemMode, type SystemMode } from './systemMode';

export type SubsystemKey = 'agents' | 'scoring' | 'database' | 'tenantConfig' | 'guardrails';
export type SubsystemState = 'healthy' | 'warning' | 'error' | 'unknown';

export type SystemExecutionState = {
  state: 'operational' | 'idle' | 'degraded';
  mode: SystemMode;
  activeRuns: number;
  latestRunAt: string | null;
  latestSuccessAt: string | null;
  latestFailureAt: string | null;
  runsToday: number;
  latestFailureAgentName: string | null;
  failureCountLast24h: number;
};

export type SystemStatus = { status: SubsystemState; detail?: string };
export type SystemStatusMap = Record<SubsystemKey, SystemStatus>;

async function checkDatabase(): Promise<SystemStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', detail: 'Connected' };
  } catch (error) {
    if (isPrismaUnavailableError(error)) {
      return { status: 'error', detail: 'Database unavailable' };
    }

    return { status: 'error', detail: 'Database query failed' };
  }
}

async function checkTenantConfig(): Promise<SystemStatus> {
  try {
    const tableAvailable = await isTableAvailable('Tenant');

    if (!tableAvailable) {
      return { status: 'error', detail: 'Tenant table missing' };
    }

    const tenantCount = await prisma.tenant.count();

    if (tenantCount === 0) {
      return { status: 'warning', detail: 'No tenants configured' };
    }

    return { status: 'healthy', detail: 'Tenant present' };
  } catch (error) {
    if (isPrismaUnavailableError(error)) {
      return { status: 'error', detail: 'Tenant config unavailable' };
    }

    return { status: 'unknown' };
  }
}

async function checkGuardrails(): Promise<SystemStatus> {
  try {
    const guardrails = await loadTenantGuardrailConfig('default-tenant');

    if (guardrails.source === 'database') {
      return { status: 'healthy', detail: 'Guardrails enabled' };
    }

    return { status: 'warning', detail: 'Using guardrail defaults' };
  } catch (error) {
    if (isPrismaUnavailableError(error)) {
      return { status: 'error', detail: 'Guardrail config unavailable' };
    }

    return { status: 'unknown' };
  }
}

async function checkFeatureFlagStatus(
  flag: (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS],
): Promise<SystemStatus> {
  try {
    const enabled = await isFeatureEnabled(flag);

    return enabled
      ? { status: 'healthy', detail: 'Feature enabled' }
      : { status: 'warning', detail: 'Feature flag disabled' };
  } catch (error) {
    if (isPrismaUnavailableError(error)) {
      return { status: 'error', detail: 'Feature flag service unavailable' };
    }

    return { status: 'unknown', detail: 'Feature flag status unknown' };
  }
}

export async function getSystemStatus(): Promise<SystemStatusMap> {
  const result: SystemStatusMap = {
    agents: { status: 'unknown' },
    scoring: { status: 'unknown' },
    database: { status: 'unknown' },
    tenantConfig: { status: 'unknown' },
    guardrails: { status: 'unknown' },
  };

  const databaseStatus = await checkDatabase();
  result.database = databaseStatus;

  if (databaseStatus.status === 'error') {
    return result;
  }

  result.tenantConfig = await checkTenantConfig();
  result.guardrails = await checkGuardrails();
  result.agents = await checkFeatureFlagStatus(FEATURE_FLAGS.AGENTS);
  result.scoring = await checkFeatureFlagStatus(FEATURE_FLAGS.SCORING);

  return result;
}

export async function getSystemExecutionState(): Promise<SystemExecutionState> {
  try {
    const tenantId = await getCurrentTenantId();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [activeRuns, latestRun, latestFailure, latestSuccess, recentFailureCount, runsToday] = await Promise.all([
      prisma.agentRunLog.count({ where: { tenantId, status: AgentRunStatus.RUNNING } }),
      prisma.agentRunLog.findFirst({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
      prisma.agentRunLog.findFirst({
        where: { tenantId, status: AgentRunStatus.FAILED },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true, agentName: true },
      }),
      prisma.agentRunLog.findFirst({
        where: { tenantId, status: AgentRunStatus.SUCCESS },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
      prisma.agentRunLog.count({
        where: {
          tenantId,
          status: AgentRunStatus.FAILED,
          startedAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.agentRunLog.count({
        where: {
          tenantId,
          status: AgentRunStatus.SUCCESS,
          startedAt: { gte: startOfDay },
        },
      }),
    ]);

    const hasFailure = Boolean(latestFailure);
    const hasRuns = Boolean(latestRun);

    const state: SystemExecutionState['state'] = hasFailure
      ? 'degraded'
      : !hasRuns
        ? 'idle'
        : activeRuns === 0
          ? 'idle'
          : 'operational';

    const mode = await getSystemMode();

    return {
      state,
      mode,
      activeRuns,
      latestRunAt: latestRun?.startedAt.toISOString() ?? null,
      latestSuccessAt: latestSuccess?.startedAt.toISOString() ?? null,
      latestFailureAt: latestFailure?.startedAt.toISOString() ?? null,
      runsToday,
      latestFailureAgentName: latestFailure?.agentName ?? null,
      failureCountLast24h: recentFailureCount,
    };
  } catch (error) {
    if (isPrismaUnavailableError(error)) {
      console.error('[system-execution] Database unavailable; returning degraded execution state');
    } else {
      console.error('[system-execution] Unable to compute execution state', error);
    }

    const mode = await getSystemMode();

    return {
      state: 'degraded',
      mode,
      activeRuns: 0,
      latestRunAt: null,
      latestSuccessAt: null,
      latestFailureAt: null,
      runsToday: 0,
      latestFailureAgentName: null,
      failureCountLast24h: 0,
    };
  }
}
