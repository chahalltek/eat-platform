import type { SubscriptionPlan, TenantSubscription } from '@/server/db/prisma';
import { Prisma } from '@/server/db/prisma';

import { isPrismaUnavailableError, isTableAvailable, prisma } from './prisma';

export type ActiveTenantPlan = {
  plan: SubscriptionPlan;
  subscription: TenantSubscription & { plan: SubscriptionPlan };
};

export async function getTenantPlan(tenantId: string): Promise<ActiveTenantPlan | null> {
  const now = new Date();

  let hasSubscriptionTable: boolean | null = true;

  try {
    hasSubscriptionTable = await isTableAvailable('TenantSubscription');
  } catch (error) {
    if (isPrismaUnavailableError(error)) {
      return null;
    }

    throw error;
  }

  if (hasSubscriptionTable === false) {
    return null;
  }

  // Some tests partially mock the Prisma client. If the tenant subscription model
  // is unavailable, fall back to the default plan behaviour instead of throwing.
  const tenantSubscriptionModel = prisma.tenantSubscription as
    | typeof prisma.tenantSubscription
    | undefined;

  if (!tenantSubscriptionModel?.findFirst) {
    return null;
  }

  const subscription = await tenantSubscriptionModel
    .findFirst({
      where: {
        tenantId,
        startAt: { lte: now },
        OR: [{ endAt: null }, { endAt: { gt: now } }],
      },
      orderBy: { startAt: 'desc' },
      include: { plan: true },
    })
    .catch((error) => {
      if (
        isPrismaUnavailableError(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021')
      ) {
        return null;
      }

      throw error;
    });

  if (!subscription) {
    return null;
  }

  return {
    plan: subscription.plan,
    subscription,
  };
}
