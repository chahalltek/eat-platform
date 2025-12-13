import type { CostDriverType, Prisma, PrismaClient } from '@prisma/client';

import * as PrismaService from '@/lib/prisma';

export type CostEventPayload = {
  tenantId?: string | null;
  driver: CostDriverType;
  value: number;
  unit: string;
  sku?: string | null;
  feature?: string | null;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
};

export async function recordCostEvent(
  payload: CostEventPayload,
  client: PrismaClient = PrismaService.prisma,
): Promise<void> {
  const { tenantId = null, driver, value, unit, sku = null, feature = null, metadata, occurredAt } = payload;

  if (value === undefined || value === null) return;

  let isTableAvailable: ((table: string) => Promise<boolean>) | undefined;

  try {
    isTableAvailable = PrismaService.isTableAvailable;
  } catch {
    isTableAvailable = undefined;
  }

  if (typeof isTableAvailable === 'function') {
    const tableAvailable = await isTableAvailable('CostEvent');
    if (!tableAvailable) return;
  }

  if (!client?.costEvent?.create) return;

  await client.costEvent.create({
    data: {
      tenantId,
      driver,
      value,
      unit,
      sku,
      feature,
      metadata,
      occurredAt: occurredAt ?? new Date(),
    },
  });
}
