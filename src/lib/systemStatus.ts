import { FEATURE_FLAGS, isFeatureEnabled } from './featureFlags';
import { isPrismaUnavailableError, isTableAvailable, prisma } from './prisma';

export type SubsystemKey = 'agents' | 'scoring' | 'database' | 'tenantConfig';
export type SubsystemState = 'healthy' | 'warning' | 'error' | 'unknown';

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
  };

  const databaseStatus = await checkDatabase();
  result.database = databaseStatus;

  if (databaseStatus.status === 'error') {
    return result;
  }

  result.tenantConfig = await checkTenantConfig();
  result.agents = await checkFeatureFlagStatus(FEATURE_FLAGS.AGENTS);
  result.scoring = await checkFeatureFlagStatus(FEATURE_FLAGS.SCORING);

  return result;
}
