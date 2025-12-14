import { prisma } from '@/server/db';
import type { BenchmarkRelease } from './releaseRegistry';

export type InsightSnapshotFilters = {
  roleFamily?: string;
  industry?: string;
  region?: string;
};

export type InsightSnapshotChart = {
  type: 'bar' | 'line';
  series: { label: string; value: number; sampleSize?: number }[];
  units: string;
};

export type InsightSnapshotContent = {
  headline: string;
  subtitle?: string;
  chart: InsightSnapshotChart;
  interpretation: string[];
  methodology: string;
  meta: {
    releaseId: string;
    metricKey: string;
    filters: InsightSnapshotFilters;
    templateKey?: string;
  };
};

type SnapshotTemplate = {
  key: string;
  metricKey: string;
  units: string;
  headline: (ctx: { release: BenchmarkRelease; filters: InsightSnapshotFilters }) => string;
  subtitle?: string;
  methodology: string;
};

const DEFAULT_METHODOLOGY =
  'Aggregated across opted-in tenants; minimum sample size and suppression rules applied before publication.';

const SNAPSHOT_TEMPLATES: SnapshotTemplate[] = [
  {
    key: 'scarcity-index',
    metricKey: 'scarcity-index',
    units: 'index',
    headline: ({ release, filters }) =>
      `${filters.roleFamily ?? 'Data'} roles show rising scarcity in ${filters.region ?? 'national benchmarks'} (${release.id})`,
    subtitle: 'Demand signals for technical roles using benchmark scarcity index.',
    methodology: DEFAULT_METHODOLOGY,
  },
  {
    key: 'time-to-fill',
    metricKey: 'time-to-fill',
    units: 'days',
    headline: ({ release, filters }) =>
      `Median time-to-fill is lengthening for ${filters.roleFamily ?? 'target roles'} (${release.id})`,
    subtitle: 'Operational speed benchmarked across opted-in tenants.',
    methodology: DEFAULT_METHODOLOGY,
  },
  {
    key: 'market-heatmap',
    metricKey: 'market-heatmap',
    units: 'index',
    headline: ({ release }) => `Market heatmap highlights emerging hubs (${release.id})`,
    subtitle: 'Regional concentration and growth indicators derived from benchmark signals.',
    methodology: DEFAULT_METHODOLOGY,
  },
];

function formatSeriesLabel(date: Date, fallback: string) {
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().split('T')[0];
}

function pickTemplate(templateKey?: string, metricKey?: string): SnapshotTemplate {
  if (templateKey) {
    const found = SNAPSHOT_TEMPLATES.find((template) => template.key === templateKey);
    if (found) return found;
  }

  if (metricKey) {
    const found = SNAPSHOT_TEMPLATES.find((template) => template.metricKey === metricKey);
    if (found) return found;
  }

  return SNAPSHOT_TEMPLATES[0];
}

function buildInterpretation(
  latest: { value: number; sampleSize?: number } | undefined,
  previous: { value: number } | undefined,
  metricKey: string,
  filters: InsightSnapshotFilters,
) {
  const statements: string[] = [];

  if (latest) {
    const scope = [filters.roleFamily, filters.industry, filters.region].filter(Boolean).join(' • ');
    statements.push(
      scope
        ? `${metricKey} for ${scope} is ${latest.value.toFixed(1)} (${latest.sampleSize ?? 0} samples).`
        : `${metricKey} now tracks at ${latest.value.toFixed(1)} (${latest.sampleSize ?? 0} samples).`,
    );
  }

  if (latest && previous) {
    const delta = latest.value - previous.value;
    const direction = delta >= 0 ? 'increased' : 'decreased';
    statements.push(`${metricKey} ${direction} ${Math.abs(delta).toFixed(1)} points versus the prior period.`);
  }

  if (statements.length === 0) {
    statements.push('No benchmark observations available yet for this slice.');
  }

  statements.push('No raw tenant data included; all series are pre-aggregated.');

  return statements;
}

export async function buildInsightSnapshot({
  release,
  metricKey,
  templateKey,
  filters = {},
}: {
  release: BenchmarkRelease;
  metricKey?: string;
  templateKey?: string;
  filters?: InsightSnapshotFilters;
}): Promise<InsightSnapshotContent> {
  const template = pickTemplate(templateKey, metricKey ?? release.metricKeys[0]);
  const resolvedMetricKey = metricKey ?? template.metricKey;

  const aggregates = await prisma.learningAggregate.findMany({
    where: {
      signalType: resolvedMetricKey,
      roleFamily: filters.roleFamily ?? undefined,
      industry: filters.industry ?? undefined,
      region: filters.region ?? undefined,
    },
    orderBy: { createdAt: 'desc' },
    take: 4,
  });

  const chartSeries = aggregates.length
    ? aggregates.map((aggregate) => ({
        label: formatSeriesLabel(aggregate.createdAt, release.id),
        value: aggregate.value,
        sampleSize: aggregate.sampleSize,
      }))
    : [
        {
          label: release.id,
          value: 0,
          sampleSize: 0,
        },
      ];

  const [latest, previous] = chartSeries;

  return {
    headline: template.headline({ release, filters }),
    subtitle: template.subtitle,
    chart: {
      type: 'bar',
      series: chartSeries,
      units: template.units,
    },
    interpretation: buildInterpretation(latest, previous, resolvedMetricKey, filters),
    methodology: template.methodology,
    meta: {
      releaseId: release.id,
      metricKey: resolvedMetricKey,
      filters,
      templateKey: templateKey ?? template.key,
    },
  } satisfies InsightSnapshotContent;
}
