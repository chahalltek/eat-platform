import { Prisma } from '@/server/db';

import { prisma } from '@/server/db';

export type SubscriptionPlan = {
  maxUsers?: number;
  maxAgents?: number;
  maxAgentRunsPerDay?: number;
};

export type TenantAction = 'createUser' | 'createAgentDefinition' | 'createAgentRun';

export class TenantUsageLimitError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly action: TenantAction,
    public readonly limit: number,
    public readonly usage: number,
  ) {
    super(`Tenant ${tenantId} exceeded ${action} limit (${usage}/${limit}).`);
    this.name = 'TenantUsageLimitError';
  }
}

export type TenantLimitSnapshot = {
  usage: number | null;
  limit: number | null | undefined;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlan = {
  maxUsers: Number(process.env.SUBSCRIPTION_MAX_USERS ?? 50),
  maxAgents: Number(process.env.SUBSCRIPTION_MAX_AGENTS ?? 10),
  maxAgentRunsPerDay: Number(process.env.SUBSCRIPTION_MAX_AGENT_RUNS_PER_DAY ?? 250),
};

type UsageCheck = {
  limitKey: keyof SubscriptionPlan;
  usage: (tenantId: string) => Promise<number>;
};

type SubscriptionPlanResolver = (
  tenantId: string,
) => SubscriptionPlan | Promise<SubscriptionPlan>;

let resolvePlan: SubscriptionPlanResolver = () => DEFAULT_SUBSCRIPTION_PLAN;

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

async function countAgentDefinitions() {
  if (!prisma.agentPrompt?.count) return 0;

  try {
    return await prisma.agentPrompt.count();
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

const USAGE_CHECKS: Record<TenantAction, UsageCheck> = {
  createUser: {
    limitKey: 'maxUsers',
    usage: (tenantId) => prisma.user.count({ where: { tenantId } }),
  },
  createAgentDefinition: {
    limitKey: 'maxAgents',
    usage: () => countAgentDefinitions(),
  },
  createAgentRun: {
    limitKey: 'maxAgentRunsPerDay',
    usage: (tenantId) =>
      prisma.agentRunLog.count({
        where: { tenantId, startedAt: { gte: new Date(Date.now() - ONE_DAY_MS) } },
      }),
  },
};

export function setSubscriptionPlanResolver(resolver: SubscriptionPlanResolver) {
  resolvePlan = resolver;
}

export function resetSubscriptionPlanResolver() {
  resolvePlan = () => DEFAULT_SUBSCRIPTION_PLAN;
}

export async function assertTenantWithinLimits(
  tenantId: string,
  action: TenantAction,
): Promise<TenantLimitSnapshot> {
  const plan = await resolvePlan(tenantId);
  const config = USAGE_CHECKS[action];
  const limit = plan[config.limitKey];

  if (limit == null) {
    return { usage: null, limit } satisfies TenantLimitSnapshot;
  }

  const usage = await config.usage(tenantId);

  if (usage >= limit) {
    throw new TenantUsageLimitError(tenantId, action, limit, usage);
  }

  return { usage, limit } satisfies TenantLimitSnapshot;
}
