import type { UsageEventType } from '@/server/db/prisma';

import { isTableAvailable, prisma } from '@/server/db/prisma';

export type TenantUsageSnapshot = {
  tenantId: string;
  tenantName: string;
  totals: Record<UsageEventType, number>;
  monthStart: Date;
};

const ALL_DIMENSIONS: UsageEventType[] = [
  'JOBS_PROCESSED',
  'CANDIDATES_EVALUATED',
  'AGENT_RUN',
  'EXPLAIN_CALL',
  'COPILOT_CALL',
];

export function getCurrentMonthStart(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  return new Date(Date.UTC(year, month, 1));
}

export async function getMonthlyUsageSnapshots(referenceDate = new Date()): Promise<TenantUsageSnapshot[]> {
  const tableAvailable = await isTableAvailable('UsageEvent');
  if (!tableAvailable) return [];

  const monthStart = getCurrentMonthStart(referenceDate);

  const [tenants, grouped] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, name: true } }),
    prisma.usageEvent.groupBy({
      by: ['tenantId', 'eventType'],
      where: { occurredAt: { gte: monthStart } },
      _sum: { count: true },
    }),
  ]);

  const totalsByTenant = new Map<string, Record<UsageEventType, number>>();

  tenants.forEach((tenant) => {
    totalsByTenant.set(
      tenant.id,
      ALL_DIMENSIONS.reduce((acc, dimension) => ({ ...acc, [dimension]: 0 }), {} as Record<UsageEventType, number>),
    );
  });

  for (const row of grouped) {
    const totals = totalsByTenant.get(row.tenantId);
    if (!totals) continue;

    totals[row.eventType] = (row._sum.count ?? 0) + totals[row.eventType];
  }

  return tenants.map((tenant) => ({
    tenantId: tenant.id,
    tenantName: tenant.name,
    totals: totalsByTenant.get(tenant.id)!,
    monthStart,
  }));
}

export function formatUsageTotal(totals: Record<UsageEventType, number>, dimension: UsageEventType) {
  return totals[dimension] ?? 0;
}
