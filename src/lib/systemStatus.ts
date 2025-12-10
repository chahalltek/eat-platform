import { FEATURE_FLAGS, isFeatureEnabled } from './featureFlags';
import { isPrismaUnavailableError, isTableAvailable, prisma } from './prisma';

export type SubsystemKey = 'agents' | 'scoring' | 'database' | 'tenantConfig';
export type SubsystemState = 'healthy' | 'warning' | 'error' | 'unknown';

export type SystemStatusMap = Record<SubsystemKey, { status: SubsystemState; detail?: string }>; 

async function checkDatabase(): Promise<{ status: SubsystemState; detail?: string }> {
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

async function checkTenantConfig(): Promise<{ status: SubsystemState; detail?: string }> {
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

async function checkFeatureFlagStatus(flag: (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]): Promise<SubsystemState> {
  try {
    const enabled = await isFeatureEnabled(flag);

    return enabled ? 'healthy' : 'warning';
  } catch (error) {
    if (isPrismaUnavailableError(error)) {
      return 'error';
    }

    return 'unknown';
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
  result.agents = { status: await checkFeatureFlagStatus(FEATURE_FLAGS.AGENTS) };
  result.scoring = { status: await checkFeatureFlagStatus(FEATURE_FLAGS.SCORING) };

  return result;
}
