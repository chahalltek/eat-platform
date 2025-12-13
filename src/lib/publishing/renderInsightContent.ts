import type { InsightSnapshotRecord } from './insightSnapshots';

export type InsightPdfSection = {
  heading: string;
  body: string[];
};

export type InsightPdfContent = {
  title: string;
  subtitle?: string | null;
  chart: InsightSnapshotRecord['contentJson']['chart'];
  meta: InsightSnapshotRecord['contentJson']['meta'] & {
    audience: InsightSnapshotRecord['audience'];
    status: InsightSnapshotRecord['status'];
    releaseId: string;
  };
  sections: InsightPdfSection[];
};

function renderFilters(filters: InsightSnapshotRecord['contentJson']['meta']['filters']) {
  const entries = Object.entries(filters).filter(([, value]) => Boolean(value));
  if (entries.length === 0) return 'none';

  return entries.map(([key, value]) => `${key}: ${value}`).join(' • ');
}

export function renderInsightMarkdown(snapshot: InsightSnapshotRecord) {
  const { headline, subtitle, chart, interpretation, methodology, meta } = snapshot.contentJson;

  const markdownLines: string[] = [
    `# ${headline}`,
  ];

  if (subtitle) {
    markdownLines.push('', `_${subtitle}_`);
  }

  markdownLines.push(
    '',
    `**Release:** ${snapshot.releaseId}`,
    `**Audience:** ${snapshot.audience}`,
    `**Status:** ${snapshot.status}`,
    `**Metric:** ${meta.metricKey} (${chart.units})`,
    `**Filters:** ${renderFilters(meta.filters)}`,
    '',
    '## Chart',
    '| Label | Value | Samples |',
    '| --- | ---: | ---: |',
    ...chart.series.map((series) => `| ${series.label} | ${series.value.toFixed(1)} | ${series.sampleSize ?? 0} |`),
    '',
    '## Interpretation',
    ...interpretation.map((item) => `- ${item}`),
    '',
    '## Methodology',
    methodology,
    '',
    '## Provenance',
    `Content derived from snapshot ${snapshot.id} built from release ${meta.releaseId}.`,
  );

  return markdownLines.join('\n');
}

export function buildPdfReadyInsight(snapshot: InsightSnapshotRecord): InsightPdfContent {
  const { headline, subtitle, chart, interpretation, methodology, meta } = snapshot.contentJson;

  return {
    title: headline,
    subtitle: subtitle ?? null,
    chart,
    meta: {
      ...meta,
      audience: snapshot.audience,
      status: snapshot.status,
      releaseId: snapshot.releaseId,
    },
    sections: [
      {
        heading: 'Interpretation',
        body: interpretation,
      },
      {
        heading: 'Methodology',
        body: [methodology],
      },
      {
        heading: 'Provenance',
        body: [`Snapshot ${snapshot.id} built from release ${meta.releaseId}.`],
      },
    ],
  } satisfies InsightPdfContent;
}
