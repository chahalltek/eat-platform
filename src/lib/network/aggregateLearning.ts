import { prismaAdmin } from "@/lib/prismaAdmin";

export type LearningSignalType = "skill_scarcity" | "confidence_dist" | "time_to_fill";

export type LearningSignal = {
  tenantId: string;
  roleFamily: string;
  industry: string | null;
  region: string | null;
  signalType: LearningSignalType;
  value: number;
  sampleSize: number;
  windowDays: number;
  capturedAt: Date;
};

export type AggregationResult = {
  created: number;
  tenantsConsidered: number;
  signalsEvaluated: number;
};

export const DEFAULT_MINIMUM_SAMPLE_SIZE = 10;

function startOfWeek(date: Date) {
  const weekStart = new Date(date);
  weekStart.setUTCHours(0, 0, 0, 0);
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  return weekStart;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function runLearningAggregation(options?: {
  minimumSampleSize?: number;
  referenceDate?: Date;
}) {
  const isLearningSignalType = (value: string): value is LearningSignalType =>
    value === "skill_scarcity" || value === "confidence_dist" || value === "time_to_fill";

  const minimumSampleSize = options?.minimumSampleSize ?? DEFAULT_MINIMUM_SAMPLE_SIZE;
  const referenceDate = options?.referenceDate ?? new Date();
  const aggregationWeek = startOfWeek(referenceDate);
  const allowedTenants = await prismaAdmin.tenant.findMany({
    where: { config: { networkLearningOptIn: true } },
    select: { id: true },
  });

  const tenantIds = allowedTenants.map((tenant) => tenant.id);
  if (tenantIds.length === 0) {
    return { created: 0, tenantsConsidered: 0, signalsEvaluated: 0 } satisfies AggregationResult;
  }

  const rawSignals = await prismaAdmin.tenantLearningSignal.findMany({
    where: { tenantId: { in: tenantIds }, sampleSize: { gte: minimumSampleSize } },
  });

  const eligibleSignals = rawSignals.filter(
    (signal) => signal.sampleSize >= minimumSampleSize && tenantIds.includes(signal.tenantId),
  );

  const typedSignals = eligibleSignals.filter((signal): signal is typeof signal & { signalType: LearningSignalType } =>
    isLearningSignalType(signal.signalType),
  );

  if (typedSignals.length === 0) {
    return {
      created: 0,
      tenantsConsidered: tenantIds.length,
      signalsEvaluated: typedSignals.length,
    } satisfies AggregationResult;
  }

  const grouped = new Map<
    string,
    {
      roleFamily: string;
      industry: string | null;
      region: string | null;
      signalType: LearningSignalType;
      windowDays: number;
      weightedValue: number;
      totalSample: number;
    }
  >();

  for (const signal of typedSignals) {
    const key = [
      signal.roleFamily,
      signal.industry ?? "",
      signal.region ?? "",
      signal.signalType,
      signal.windowDays,
    ].join("::");

    const bucket =
      grouped.get(key) ?? {
        roleFamily: signal.roleFamily,
        industry: signal.industry ?? null,
        region: signal.region ?? null,
        signalType: signal.signalType,
        windowDays: signal.windowDays,
        weightedValue: 0,
        totalSample: 0,
      };

    bucket.weightedValue += signal.value * signal.sampleSize;
    bucket.totalSample += signal.sampleSize;
    grouped.set(key, bucket);
  }

  const aggregates = Array.from(grouped.values())
    .map((entry) => ({
      roleFamily: entry.roleFamily,
      industry: entry.industry,
      region: entry.region,
      signalType: entry.signalType,
      windowDays: entry.windowDays,
      sampleSize: entry.totalSample,
      value: entry.totalSample === 0 ? 0 : Number((entry.weightedValue / entry.totalSample).toFixed(4)),
      createdAt: aggregationWeek,
    }))
    .sort((a, b) => {
      const familyComparison = a.roleFamily.localeCompare(b.roleFamily);
      if (familyComparison !== 0) return familyComparison;

      const industryComparison = (a.industry ?? "").localeCompare(b.industry ?? "");
      if (industryComparison !== 0) return industryComparison;

      const regionComparison = (a.region ?? "").localeCompare(b.region ?? "");
      if (regionComparison !== 0) return regionComparison;

      const signalComparison = a.signalType.localeCompare(b.signalType);
      if (signalComparison !== 0) return signalComparison;

      return a.windowDays - b.windowDays;
    });

  const deleteWindowEnd = addDays(aggregationWeek, 7);

  await prismaAdmin.learningAggregate.deleteMany({
    where: { createdAt: { gte: aggregationWeek, lt: deleteWindowEnd } },
  });

  if (aggregates.length > 0) {
    await prismaAdmin.learningAggregate.createMany({ data: aggregates });
  }

  return {
    created: aggregates.length,
    tenantsConsidered: tenantIds.length,
    signalsEvaluated: typedSignals.length,
  } satisfies AggregationResult;
}
