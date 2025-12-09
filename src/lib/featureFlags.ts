import type { FeatureFlag as FeatureFlagModel } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { DEFAULT_FLAG_DESCRIPTIONS, FEATURE_FLAGS, type FeatureFlagName } from './featureFlags/constants';
import { isFeatureEnabledForPlan } from './featureFlags/planMapping';
import { isPrismaUnavailableError, isTableAvailable, prisma } from './prisma';
import { getTenantPlan } from './subscriptionPlans';
import { getCurrentTenantId } from './tenant';

export type FeatureFlagRecord = {
  name: FeatureFlagName;
  description: string | null;
  enabled: boolean;
  updatedAt: Date;
};

export { FEATURE_FLAGS, type FeatureFlagName } from './featureFlags/constants';

const flagCache = new Map<string, boolean>();

function buildFallbackFlag(name: FeatureFlagName, enabled = false) {
  return {
    name,
    description: DEFAULT_FLAG_DESCRIPTIONS[name],
    enabled,
    updatedAt: new Date(0),
  };
}

function coerceFlagName(value: unknown): FeatureFlagName | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const candidates = Object.values(FEATURE_FLAGS) as FeatureFlagName[];

  return (candidates.find((flag) => flag === normalized) as FeatureFlagName | undefined) ?? null;
}

function cacheKey(tenantId: string, name: FeatureFlagName) {
  return `${tenantId}:${name}`;
}

export function resetFeatureFlagCache() {
  flagCache.clear();
}

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

async function findFeatureFlagOverride(tenantId: string, name: FeatureFlagName) {
  if (!(await isTableAvailable('FeatureFlag'))) return null;

  try {
    return await prisma.featureFlag.findFirst({ where: { tenantId, name } });
  } catch (error) {
    if (isMissingTableError(error) || isPrismaUnavailableError(error)) return null;
    throw error;
  }
}

async function fetchFeatureFlagOverrides(tenantId: string) {
  if (!(await isTableAvailable('FeatureFlag'))) {
    return new Map<FeatureFlagName, FeatureFlagModel>();
  }

  try {
    const overrides = await prisma.featureFlag.findMany({ where: { tenantId } });

    return new Map(overrides.map((flag) => [flag.name as FeatureFlagName, flag]));
  } catch (error) {
    if (isMissingTableError(error) || isPrismaUnavailableError(error)) {
      return new Map<FeatureFlagName, FeatureFlagModel>();
    }

    throw error;
  }
}

export async function listFeatureFlags(): Promise<FeatureFlagRecord[]> {
  const tenantId = await getCurrentTenantId();
  const [overrides, plan] = await Promise.all([
    fetchFeatureFlagOverrides(tenantId),
    getTenantPlan(tenantId),
  ]);

  const planId = plan?.plan.id;

  return (Object.values(FEATURE_FLAGS) as FeatureFlagName[])
    .map((name) => {
      const override = overrides.get(name);
      const enabledByPlan = planId ? isFeatureEnabledForPlan(planId, name) : false;
      const enabled = override?.enabled ?? enabledByPlan ?? false;

      if (override) {
        flagCache.set(cacheKey(tenantId, name), override.enabled);
      }

      return {
        name,
        description: override?.description ?? DEFAULT_FLAG_DESCRIPTIONS[name],
        enabled,
        updatedAt: override?.updatedAt ?? new Date(0),
      } satisfies FeatureFlagRecord;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function isFeatureEnabledForTenant(
  tenantId: string,
  name: FeatureFlagName,
): Promise<boolean> {
  const cached = flagCache.get(cacheKey(tenantId, name));

  if (cached != null) {
    return cached;
  }

  const override = await findFeatureFlagOverride(tenantId, name);

  if (override) {
    flagCache.set(cacheKey(tenantId, name), override.enabled);
    return override.enabled;
  }

  const plan = await getTenantPlan(tenantId);

  return plan ? isFeatureEnabledForPlan(plan.plan.id, name) : false;
}

export async function getFeatureFlag(
  tenantId: string,
  name: FeatureFlagName,
): Promise<boolean> {
  return isFeatureEnabledForTenant(tenantId, name);
}

export async function isFeatureEnabled(name: FeatureFlagName): Promise<boolean> {
  const tenantId = await getCurrentTenantId();

  return getFeatureFlag(tenantId, name);
}

export async function isEnabled(tenantId: string, name: FeatureFlagName): Promise<boolean> {
  return getFeatureFlag(tenantId, name);
}

export async function setFeatureFlag(name: FeatureFlagName, enabled: boolean): Promise<FeatureFlagRecord> {
  const tenantId = await getCurrentTenantId();

  if (!(await isTableAvailable('FeatureFlag'))) {
    const fallback = buildFallbackFlag(name, enabled);

    flagCache.set(cacheKey(tenantId, name), fallback.enabled);

    return fallback;
  }

  const flag = await prisma.$transaction(async (tx) => {
    const existing = await tx.featureFlag.findFirst({ where: { tenantId, name } });

    if (existing) {
      return tx.featureFlag.update({ where: { id: existing.id }, data: { enabled } });
    }

    return tx.featureFlag.create({
      data: { tenantId, name, enabled, description: DEFAULT_FLAG_DESCRIPTIONS[name] },
    });
  }).catch((error) => {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') ||
      error instanceof Prisma.PrismaClientInitializationError
    ) {
      return buildFallbackFlag(name, enabled);
    }

    throw error;
  });

  flagCache.set(cacheKey(tenantId, name), flag.enabled);

  return {
    name: flag.name as FeatureFlagName,
    description: flag.description,
    enabled: flag.enabled,
    updatedAt: flag.updatedAt,
  };
}

export function parseFeatureFlagName(value: unknown): FeatureFlagName | null {
  return coerceFlagName(value);
}

export function describeFeatureFlag(name: FeatureFlagName) {
  return DEFAULT_FLAG_DESCRIPTIONS[name];
}
