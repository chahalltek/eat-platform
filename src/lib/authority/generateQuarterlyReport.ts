import fs from 'node:fs/promises';
import path from 'node:path';
import type { InsightSnapshotContent } from '@/lib/publishing/buildInsightSnapshot';
import type { BenchmarkRelease } from '@/lib/publishing/releaseRegistry';

export type QuarterlyReportStatus = 'draft' | 'reviewed' | 'published';

export type AggregatedForecast = {
  segment: string;
  horizon: '30d' | '60d' | '90d';
  medianTimeToFillDays: number;
  confidence: 'low' | 'medium' | 'high';
  direction: 'tightening' | 'loosening' | 'stable';
};

export type QuarterlyReportSection = {
  title: string;
  summary: string;
  highlights: string[];
  footnotes?: string[];
};

export type QuarterlyReportModel = {
  meta: {
    releaseId: string;
    releaseTitle: string;
    status: QuarterlyReportStatus;
    generatedAt: string;
    publishedAt?: string;
    dataNotice: string;
  };
  sections: {
    executiveSummary: QuarterlyReportSection;
    marketOverview: QuarterlyReportSection;
    scarcityAndVelocity: QuarterlyReportSection;
    riskSignals: QuarterlyReportSection;
    leadershipActions: QuarterlyReportSection;
  };
};

const VALID_STATUS_TRANSITIONS: Record<QuarterlyReportStatus, QuarterlyReportStatus[]> = {
  draft: ['reviewed'],
  reviewed: ['published'],
  published: [],
};

function formatAggregateValue(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : 'n/a';
}

function formatSnapshotHighlight(snapshot: InsightSnapshotContent): string {
  const latestPoint = snapshot.chart.series.at(0);
  const value = latestPoint ? formatAggregateValue(latestPoint.value) : 'n/a';
  return `${snapshot.headline} (latest: ${value} ${snapshot.chart.units})`;
}

function buildExecutiveSummary(
  release: BenchmarkRelease,
  insightSnapshots: InsightSnapshotContent[],
  aggregatedForecasts: AggregatedForecast[],
): QuarterlyReportSection {
  const topSnapshots = insightSnapshots.slice(0, 3).map(formatSnapshotHighlight);
  const forecastCallouts = aggregatedForecasts.slice(0, 2).map(
    (forecast) =>
      `${forecast.segment}: median ${forecast.medianTimeToFillDays.toFixed(0)} days (${forecast.direction}, ${forecast.confidence} confidence).`,
  );

  return {
    title: 'Executive Summary',
    summary: `${release.title} synthesizes benchmarked scarcity, hiring velocity, and risk signals without tenant-identifiable data.`,
    highlights: [
      ...topSnapshots,
      ...forecastCallouts,
      'Report is reproducible each quarter using published benchmark releases and aggregated intelligence.',
    ],
    footnotes: ['All figures shown are pre-aggregated and publication-approved.'],
  } satisfies QuarterlyReportSection;
}

function buildMarketOverview(
  release: BenchmarkRelease,
  insightSnapshots: InsightSnapshotContent[],
): QuarterlyReportSection {
  const orderedSnapshots = [...insightSnapshots].sort((a, b) => a.meta.metricKey.localeCompare(b.meta.metricKey));
  const highlights = orderedSnapshots.map((snapshot) => `${snapshot.meta.metricKey}: ${snapshot.subtitle ?? snapshot.headline}`);

  return {
    title: 'Market Overview',
    summary: `Market signals anchored to ${release.id} benchmarks across scarcity, velocity, and regional dynamics.`,
    highlights,
    footnotes: ['Snapshot interpretations rely on benchmark aggregates only.'],
  } satisfies QuarterlyReportSection;
}

function buildScarcityAndVelocity(insightSnapshots: InsightSnapshotContent[]): QuarterlyReportSection {
  const scarcityHighlights = insightSnapshots
    .filter((snapshot) => snapshot.meta.metricKey.includes('scarcity') || snapshot.meta.metricKey.includes('time-to-fill'))
    .map((snapshot) => snapshot.interpretation.at(0) ?? snapshot.headline);

  return {
    title: 'Scarcity & Velocity Trends',
    summary: 'Aggregated benchmark movements for talent scarcity and hiring velocity with quarterly comparisons.',
    highlights: scarcityHighlights,
    footnotes: ['Trends exclude tenant-level identifiers and rely on suppression thresholds.'],
  } satisfies QuarterlyReportSection;
}

function buildRiskSignals(aggregatedForecasts: AggregatedForecast[]): QuarterlyReportSection {
  const sortedForecasts = [...aggregatedForecasts].sort((a, b) => b.medianTimeToFillDays - a.medianTimeToFillDays);
  const highlights = sortedForecasts.map(
    (forecast) =>
      `${forecast.segment} ${forecast.horizon}: ${forecast.medianTimeToFillDays.toFixed(0)} days (${forecast.direction}; ${forecast.confidence} confidence).`,
  );

  return {
    title: 'Risk Signals',
    summary: 'Forward-looking risk views based on aggregated forecasts and confidence-weighted velocity changes.',
    highlights: highlights.length ? highlights : ['No forecast aggregates available for this period.'],
    footnotes: ['Forecasts are aggregated; no tenant or candidate data is surfaced.'],
  } satisfies QuarterlyReportSection;
}

function buildLeadershipActions(
  insightSnapshots: InsightSnapshotContent[],
  aggregatedForecasts: AggregatedForecast[],
): QuarterlyReportSection {
  const actionables: string[] = [];

  const scarcitySnapshot = insightSnapshots.find((snapshot) => snapshot.meta.metricKey.includes('scarcity'));
  if (scarcitySnapshot) {
    actionables.push(`Prioritize roles flagged in scarcity index: ${scarcitySnapshot.headline}.`);
  }

  const forecastPressure = aggregatedForecasts.filter((forecast) => forecast.direction === 'tightening');
  if (forecastPressure.length) {
    actionables.push(
      `Mitigate hiring delays in tightening segments (${forecastPressure.map((forecast) => forecast.segment).join(', ')}).`,
    );
  }

  actionables.push('Align quarterly workforce plans to benchmarked velocity and apply suppression rules for all exports.');

  return {
    title: 'What This Means for Leaders',
    summary: 'Recommended focus areas derived from benchmarks, snapshots, and forward-looking signals.',
    highlights: actionables,
  } satisfies QuarterlyReportSection;
}

export function createQuarterlyReportDraft({
  release,
  insightSnapshots,
  aggregatedForecasts,
  generatedAt = new Date(),
}: {
  release: BenchmarkRelease;
  insightSnapshots: InsightSnapshotContent[];
  aggregatedForecasts: AggregatedForecast[];
  generatedAt?: Date;
}): QuarterlyReportModel {
  const executiveSummary = buildExecutiveSummary(release, insightSnapshots, aggregatedForecasts);
  const marketOverview = buildMarketOverview(release, insightSnapshots);
  const scarcityAndVelocity = buildScarcityAndVelocity(insightSnapshots);
  const riskSignals = buildRiskSignals(aggregatedForecasts);
  const leadershipActions = buildLeadershipActions(insightSnapshots, aggregatedForecasts);

  return {
    meta: {
      releaseId: release.id,
      releaseTitle: release.title,
      status: 'draft',
      generatedAt: generatedAt.toISOString(),
      dataNotice: 'No tenant-identifiable data used; all sources are aggregated and publication-approved.',
    },
    sections: {
      executiveSummary,
      marketOverview,
      scarcityAndVelocity,
      riskSignals,
      leadershipActions,
    },
  } satisfies QuarterlyReportModel;
}

export function advanceQuarterlyReportStatus(
  report: QuarterlyReportModel,
  nextStatus: QuarterlyReportStatus,
): QuarterlyReportModel {
  const allowed = VALID_STATUS_TRANSITIONS[report.meta.status];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid status transition from ${report.meta.status} to ${nextStatus}`);
  }

  return {
    ...report,
    meta: {
      ...report.meta,
      status: nextStatus,
      publishedAt: nextStatus === 'published' ? new Date().toISOString() : report.meta.publishedAt,
    },
  } satisfies QuarterlyReportModel;
}

export async function saveQuarterlyReportVersion(
  report: QuarterlyReportModel,
  baseDir = path.join(process.cwd(), 'authority', 'reports'),
): Promise<string> {
  const releaseDir = path.join(baseDir, report.meta.releaseId);
  await fs.mkdir(releaseDir, { recursive: true });
  const timestamp = (report.meta.publishedAt ?? report.meta.generatedAt).replace(/[:.]/g, '-');
  const fileName = `q-tir-${report.meta.status}-${timestamp}.json`;
  const filePath = path.join(releaseDir, fileName);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filePath;
}

export type ReportGeneratorIO = {
  release: BenchmarkRelease;
  insightSnapshots: InsightSnapshotContent[];
  aggregatedForecasts: AggregatedForecast[];
};

export async function generateQuarterlyReport(io: ReportGeneratorIO): Promise<QuarterlyReportModel> {
  const draft = createQuarterlyReportDraft({
    release: io.release,
    insightSnapshots: io.insightSnapshots,
    aggregatedForecasts: io.aggregatedForecasts,
  });

  const reviewed = advanceQuarterlyReportStatus(draft, 'reviewed');
  const published = advanceQuarterlyReportStatus(reviewed, 'published');

  await saveQuarterlyReportVersion(published);

  return published;
}
