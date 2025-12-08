import type { SubscriptionPlan, TenantSubscription } from '@prisma/client';

import { prisma } from './prisma';

export type ActiveTenantPlan = {
  plan: SubscriptionPlan;
  subscription: TenantSubscription & { plan: SubscriptionPlan };
};

export async function getTenantPlan(tenantId: string): Promise<ActiveTenantPlan | null> {
  const now = new Date();

  const subscription = await prisma.tenantSubscription.findFirst({
    where: {
      tenantId,
      startAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
    orderBy: { startAt: 'desc' },
    include: { plan: true },
  });

  if (!subscription) {
    return null;
  }

  return {
    plan: subscription.plan,
    subscription,
  };
}
