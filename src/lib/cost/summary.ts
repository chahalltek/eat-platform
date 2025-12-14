import type { CostDriverType } from '@/server/db';

import { getCurrentMonthStart } from '@/lib/usage/summary';
import { isTableAvailable, prisma } from '@/server/db';

export type CostDriverSnapshot = {
  tenantId: string | null;
  tenantName: string;
  driver: CostDriverType;
  sku: string | null;
  feature: string | null;
  unit: string;
  totalValue: number;
  eventCount: number;
  monthStart: Date;
};

export async function getMonthlyCostSnapshots(referenceDate = new Date()): Promise<CostDriverSnapshot[]> {
  const tableAvailable = await isTableAvailable('CostEvent');
  if (!tableAvailable) return [];

  const monthStart = getCurrentMonthStart(referenceDate);

  const [tenants, grouped] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, name: true } }),
    prisma.costEvent.groupBy({
      by: ['tenantId', 'driver', 'sku', 'feature', 'unit'],
      where: { occurredAt: { gte: monthStart } },
      _sum: { value: true },
      _count: { _all: true },
    }),
  ]);

  const tenantNameById = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));

  return grouped
    .map((row) => ({
      tenantId: row.tenantId,
      tenantName:
        (row.tenantId ? tenantNameById.get(row.tenantId) : 'Platform') ?? `${row.tenantId ?? 'Unknown'} (unmapped)`,
      driver: row.driver,
      sku: row.sku ?? null,
      feature: row.feature ?? null,
      unit: row.unit,
      totalValue: row._sum.value ?? 0,
      eventCount: row._count._all,
      monthStart,
    }))
    .sort((a, b) => {
      const tenantComparison = a.tenantName.localeCompare(b.tenantName);
      if (tenantComparison !== 0) return tenantComparison;
      return a.driver.localeCompare(b.driver);
    });
}

export function formatCostValue(snapshot: CostDriverSnapshot) {
  if (snapshot.unit === 'ms') {
    const seconds = snapshot.totalValue / 1000;
    return `${seconds.toFixed(1)} s`;
  }

  return `${snapshot.totalValue.toLocaleString()} ${snapshot.unit}`;
}
