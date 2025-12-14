import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SubscriptionPlan, Tenant, TenantSubscription } from "@/server/db";

import {
  getTenantPlanDetail,
  listTenantsWithPlans,
  NotFoundError,
  updateTenantPlan,
  ValidationError,
} from "./tenants";

const prismaMock = vi.hoisted(() => ({
  tenant: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  subscriptionPlan: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  tenantSubscription: {
    update: vi.fn(),
    create: vi.fn(),
  },
}));

const isTableAvailableMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock("@/server/db", () => ({
  prisma: prismaMock,
  isTableAvailable: isTableAvailableMock,
}));

const baseTenant: Tenant = {
  id: "tenant-1",
  name: "Tenant One",
  status: "active",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

const standardPlan: SubscriptionPlan = {
  id: "plan-standard",
  name: "Standard",
  limits: {},
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

const premiumPlan: SubscriptionPlan = {
  id: "plan-premium",
  name: "Premium",
  limits: {},
  createdAt: new Date("2024-01-05T00:00:00.000Z"),
};

const subscription: TenantSubscription & { plan: SubscriptionPlan } = {
  id: "sub-1",
  tenantId: baseTenant.id,
  planId: standardPlan.id,
  plan: standardPlan,
  startAt: new Date("2024-02-01T00:00:00.000Z"),
  endAt: null,
  isTrial: false,
  createdAt: new Date("2024-02-01T00:00:00.000Z"),
};

describe("admin tenants library", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("lists tenants with their active plans", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([{
      ...baseTenant,
      subscriptions: [subscription],
    }]);

    const result = await listTenantsWithPlans();

    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: {
        tenantMode: true,
        subscriptions: {
          where: {
            startAt: { lte: new Date("2024-03-01T00:00:00.000Z") },
            OR: [{ endAt: null }, { endAt: { gt: new Date("2024-03-01T00:00:00.000Z") } }],
          },
          orderBy: { startAt: "desc" },
          take: 1,
          include: { plan: true },
        },
      },
    });

    expect(result).toEqual([
      {
        id: baseTenant.id,
        name: baseTenant.name,
        status: baseTenant.status,
        mode: "pilot",
        createdAt: baseTenant.createdAt,
        plan: { id: subscription.plan.id, name: subscription.plan.name },
        isTrial: false,
        trialEndsAt: null,
      },
    ]);
  });

  it("returns details and plan catalog for a single tenant", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, subscriptions: [subscription] });
    prismaMock.subscriptionPlan.findMany.mockResolvedValue([standardPlan, premiumPlan]);

    const result = await getTenantPlanDetail(baseTenant.id);

    expect(result).toEqual({
      tenant: {
        id: baseTenant.id,
        name: baseTenant.name,
        status: baseTenant.status,
        mode: "pilot",
        createdAt: baseTenant.createdAt,
        plan: { id: standardPlan.id, name: standardPlan.name },
        isTrial: false,
        trialEndsAt: null,
      },
      plans: [standardPlan, premiumPlan],
    });
  });

  it("throws when requesting an unknown tenant", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    await expect(getTenantPlanDetail("missing-tenant")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updates the tenant plan and closes the previous subscription", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, subscriptions: [subscription] });
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(premiumPlan);
    prismaMock.tenantSubscription.create.mockResolvedValue({
      ...subscription,
      id: "sub-2",
      planId: premiumPlan.id,
      plan: premiumPlan,
      isTrial: true,
      endAt: new Date("2024-04-01T00:00:00.000Z"),
    });

    const result = await updateTenantPlan(baseTenant.id, premiumPlan.id, {
      isTrial: true,
      trialEndsAt: new Date("2024-04-01T00:00:00.000Z"),
    });

    expect(prismaMock.tenantSubscription.update).toHaveBeenCalledWith({
      where: { id: subscription.id },
      data: { endAt: new Date("2024-03-01T00:00:00.000Z") },
    });

    expect(prismaMock.tenantSubscription.create).toHaveBeenCalledWith({
      data: {
        tenantId: baseTenant.id,
        planId: premiumPlan.id,
        startAt: new Date("2024-03-01T00:00:00.000Z"),
        endAt: new Date("2024-04-01T00:00:00.000Z"),
        isTrial: true,
      },
      include: { plan: true },
    });

    expect(result).toEqual({
      id: baseTenant.id,
      name: baseTenant.name,
      status: baseTenant.status,
      mode: "pilot",
      createdAt: baseTenant.createdAt,
      plan: { id: premiumPlan.id, name: premiumPlan.name },
      isTrial: true,
      trialEndsAt: new Date("2024-04-01T00:00:00.000Z"),
    });
  });

  it("validates trial end dates", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, subscriptions: [subscription] });
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(premiumPlan);

    await expect(
      updateTenantPlan(baseTenant.id, premiumPlan.id, { isTrial: true, trialEndsAt: new Date("invalid") }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when the plan is missing", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...baseTenant, subscriptions: [subscription] });
    prismaMock.subscriptionPlan.findUnique.mockResolvedValue(null);

    await expect(updateTenantPlan(baseTenant.id, "unknown-plan", {})).rejects.toBeInstanceOf(NotFoundError);
  });
});
