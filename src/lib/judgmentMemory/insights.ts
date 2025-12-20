import type { JudgmentAggregate, JudgmentAggregateDimension } from "@/server/db/prisma";

import { prisma } from "@/server/db/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export type JudgmentInsight = {
  dimension: JudgmentAggregateDimension;
  dimensionValue: string;
  metrics: Record<string, JudgmentAggregate>;
  windowStart: Date;
  windowEnd: Date;
};

export async function getLatestJudgmentInsights(): Promise<JudgmentInsight[]> {
  const tenantId = await getCurrentTenantId();
  const aggregates = await prisma.judgmentAggregate.findMany({
    where: { tenantId },
    orderBy: [{ windowEnd: "desc" }, { updatedAt: "desc" }],
  });

  if (aggregates.length === 0) return [];

  const latestWindowEnd = aggregates[0].windowEnd.getTime();
  const latestWindow = aggregates.filter((aggregate) => aggregate.windowEnd.getTime() === latestWindowEnd);

  const groups = new Map<string, JudgmentInsight>();

  latestWindow.forEach((aggregate) => {
    const key = `${aggregate.dimension}:${aggregate.dimensionValue}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        dimension: aggregate.dimension,
        dimensionValue: aggregate.dimensionValue,
        metrics: { [aggregate.metric]: aggregate },
        windowStart: aggregate.windowStart,
        windowEnd: aggregate.windowEnd,
      });
      return;
    }

    existing.metrics[aggregate.metric] = aggregate;
    existing.windowStart = aggregate.windowStart;
    existing.windowEnd = aggregate.windowEnd;
  });

  return Array.from(groups.values()).sort((a, b) => a.dimensionValue.localeCompare(b.dimensionValue));
}
