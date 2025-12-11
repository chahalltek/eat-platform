import type { SubscriptionPlan, Tenant, TenantSubscription } from "@prisma/client";

import type { SystemModeName } from "@/lib/modes/systemModes";

import { isTableAvailable, prisma } from "@/lib/prisma";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type TenantPlanSummary = {
  id: string;
  name: string;
  status: string;
  mode: SystemModeName;
  createdAt: Date;
  plan: { id: string; name: string } | null;
  isTrial: boolean;
  trialEndsAt: Date | null;
};

export type TenantPlanDetail = {
  tenant: TenantPlanSummary;
  plans: SubscriptionPlan[];
};

type TenantWithSubscription = Tenant & {
  tenantMode: { mode: string } | null;
  subscriptions: (TenantSubscription & { plan: SubscriptionPlan })[];
};

function mapTenantSummary(tenant: TenantWithSubscription): TenantPlanSummary {
  const active = tenant.subscriptions[0];

  return {
    id: tenant.id,
    name: tenant.name,
    status: tenant.status,
    mode: (tenant.tenantMode?.mode as SystemModeName | undefined) ?? "pilot",
    createdAt: tenant.createdAt,
    plan: active ? { id: active.plan.id, name: active.plan.name } : null,
    isTrial: active?.isTrial ?? false,
    trialEndsAt: active?.endAt ?? null,
  };
}

function activeSubscriptionWhere(now: Date) {
  return {
    startAt: { lte: now },
    OR: [{ endAt: null }, { endAt: { gt: now } }],
  };
}

export async function listTenantsWithPlans(): Promise<TenantPlanSummary[]> {
  const now = new Date();
  const includeTenantMode = await isTableAvailable("TenantMode");

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      ...(includeTenantMode ? { tenantMode: true } : {}),
      subscriptions: {
        where: activeSubscriptionWhere(now),
        orderBy: { startAt: "desc" },
        take: 1,
        include: { plan: true },
      },
    },
  });

  return tenants.map(mapTenantSummary);
}

export async function getTenantPlanDetail(tenantId: string): Promise<TenantPlanDetail> {
  const now = new Date();
  const includeTenantMode = await isTableAvailable("TenantMode");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      ...(includeTenantMode ? { tenantMode: true } : {}),
      subscriptions: {
        where: activeSubscriptionWhere(now),
        orderBy: { startAt: "desc" },
        take: 1,
        include: { plan: true },
      },
    },
  });

  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { name: "asc" } });

  return {
    tenant: mapTenantSummary(tenant),
    plans,
  };
}

export async function updateTenantPlan(
  tenantId: string,
  planId: string,
  options: { isTrial?: boolean; trialEndsAt?: Date | null },
): Promise<TenantPlanSummary> {
  const now = new Date();
  const includeTenantMode = await isTableAvailable("TenantMode");

  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        ...(includeTenantMode ? { tenantMode: true } : {}),
        subscriptions: {
          where: activeSubscriptionWhere(now),
          orderBy: { startAt: "desc" },
          take: 1,
          include: { plan: true },
        },
      },
    }),
    prisma.subscriptionPlan.findUnique({ where: { id: planId } }),
  ]);

  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  if (!plan) {
    throw new NotFoundError("Plan not found");
  }

  if (options.trialEndsAt && Number.isNaN(options.trialEndsAt.getTime())) {
    throw new ValidationError("Invalid trial end date");
  }

  const activeSubscription = tenant.subscriptions[0];

  if (activeSubscription && (!activeSubscription.endAt || activeSubscription.endAt > now)) {
    await prisma.tenantSubscription.update({
      where: { id: activeSubscription.id },
      data: { endAt: now },
    });
  }

  const newSubscription = await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      startAt: now,
      endAt: options.trialEndsAt ?? null,
      isTrial: options.isTrial ?? false,
    },
    include: { plan: true },
  });

  return mapTenantSummary({ ...tenant, subscriptions: [newSubscription] });
}
