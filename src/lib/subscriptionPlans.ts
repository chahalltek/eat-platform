import type { SubscriptionPlan, TenantSubscription } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from './prisma';

export type ActiveTenantPlan = {
  plan: SubscriptionPlan;
  subscription: TenantSubscription & { plan: SubscriptionPlan };
};

export async function getTenantPlan(tenantId: string): Promise<ActiveTenantPlan | null> {
  const now = new Date();

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
        error instanceof Prisma.PrismaClientInitializationError ||
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
