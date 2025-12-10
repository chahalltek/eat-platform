<<<<<<< ours
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
=======
import { prisma } from "@/lib/prisma";
import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";

type StatusLevel = "healthy" | "warning" | "error" | "unknown";

export type SubsystemStatus = {
  name: "Agents" | "Scoring" | "Database" | "Tenant Config";
  status: StatusLevel;
  detail: string;
};

async function checkAgentsApi(): Promise<SubsystemStatus> {
  try {
    const response = await fetch("/api/agents/status", { cache: "no-store" });

    if (response.ok) {
      return { name: "Agents", status: "healthy", detail: "Agents API is responding" };
    }

    return {
      name: "Agents",
      status: "warning",
      detail: `Agents API returned ${response.status}`,
    };
  } catch (error) {
    return {
      name: "Agents",
      status: "error",
      detail: error instanceof Error ? error.message : "Agents API unreachable",
    };
  }
}

async function checkScoring(): Promise<SubsystemStatus> {
  try {
    const scoringEnabled = await isFeatureEnabled(FEATURE_FLAGS.SCORING);

    return scoringEnabled
      ? { name: "Scoring", status: "healthy", detail: "Scoring flag enabled" }
      : { name: "Scoring", status: "warning", detail: "Scoring is currently disabled" };
  } catch (error) {
    return {
      name: "Scoring",
      status: "unknown",
      detail: error instanceof Error ? error.message : "Unable to load scoring status",
    };
  }
}

async function checkDatabase(): Promise<SubsystemStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return { name: "Database", status: "healthy", detail: "Database connection successful" };
  } catch (error) {
    return {
      name: "Database",
      status: "error",
      detail: error instanceof Error ? error.message : "Database unreachable",
    };
  }
}

async function checkTenantConfig(): Promise<SubsystemStatus> {
  try {
    const tenantCount = await prisma.tenant.count();

    return {
      name: "Tenant Config",
      status: "healthy",
      detail: tenantCount > 0 ? "Tenant configuration loaded" : "No tenant records found",
    };
  } catch (error) {
    return {
      name: "Tenant Config",
      status: "unknown",
      detail: error instanceof Error ? error.message : "Unable to load tenant configuration",
    };
  }
}

export async function getSystemStatus(): Promise<SubsystemStatus[]> {
  const checks = await Promise.allSettled([
    checkAgentsApi(),
    checkScoring(),
    checkDatabase(),
    checkTenantConfig(),
  ]);

  return checks.map((result, index) => {
    if (result.status === "fulfilled") return result.value;

    const names: SubsystemStatus["name"][] = ["Agents", "Scoring", "Database", "Tenant Config"];

    return {
      name: names[index],
      status: "unknown",
      detail: result.reason instanceof Error ? result.reason.message : "Status unavailable",
    } satisfies SubsystemStatus;
  });
>>>>>>> theirs
}
