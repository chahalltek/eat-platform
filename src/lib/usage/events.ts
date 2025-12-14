import type { Prisma, PrismaClient, UsageEventType } from '@/server/db';

import * as PrismaService from '@/server/db';

export type UsageEventPayload = {
  tenantId: string;
  eventType: UsageEventType;
  count?: number;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
};

const DEFAULT_COUNT = 1;

export async function recordUsageEvent(
  payload: UsageEventPayload,
  client: PrismaClient = PrismaService.prisma,
): Promise<void> {
  const { tenantId, eventType, count = DEFAULT_COUNT, metadata, occurredAt } = payload;

  if (!tenantId) return;

  let isTableAvailable: ((table: string) => Promise<boolean>) | undefined;

  try {
    isTableAvailable = PrismaService.isTableAvailable;
  } catch {
    isTableAvailable = undefined;
  }

  if (typeof isTableAvailable === 'function') {
    const tableAvailable = await isTableAvailable('UsageEvent');
    if (!tableAvailable) return;
  }

  if (!client?.usageEvent?.create) return;

  await client.usageEvent.create({
    data: {
      tenantId,
      eventType,
      count,
      metadata,
      occurredAt: occurredAt ?? new Date(),
    },
  });
}
