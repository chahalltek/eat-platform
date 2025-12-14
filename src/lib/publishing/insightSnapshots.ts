import type { NextRequest } from 'next/server';
import { Prisma } from '@/server/db';

import { prisma, isTableAvailable } from '@/server/db';
import { getCurrentUser } from '@/lib/auth/user';
import { DEFAULT_TENANT_ID } from '@/lib/auth/config';
import { isAdminRole } from '@/lib/auth/roles';
import { getCurrentTenantId } from '@/lib/tenant';
import { buildInsightSnapshot, type InsightSnapshotContent, type InsightSnapshotFilters } from './buildInsightSnapshot';
import { getPublishedBenchmarkRelease, listPublishedBenchmarkReleases } from './releaseRegistry';

export const INSIGHT_AUDIENCES = ['internal', 'client', 'public'] as const;
export const INSIGHT_STATUSES = ['draft', 'approved', 'published'] as const;

export type InsightSnapshotRecord = {
  id: string;
  releaseId: string;
  title: string;
  subtitle: string | null;
  audience: (typeof INSIGHT_AUDIENCES)[number];
  status: (typeof INSIGHT_STATUSES)[number];
  contentJson: InsightSnapshotContent;
  createdAt: string;
  publishedAt: string | null;
};

type CreateSnapshotInput = {
  releaseId: string;
  templateKey?: string;
  metricKey?: string;
  filters?: InsightSnapshotFilters;
  audience: (typeof INSIGHT_AUDIENCES)[number];
};

export async function assertAdminAccess(request?: NextRequest) {
  const user = await getCurrentUser(request);
  const tenantId = (await getCurrentTenantId(request)) ?? DEFAULT_TENANT_ID;
  const userTenant = (user?.tenantId ?? DEFAULT_TENANT_ID).trim();

  if (!user || !isAdminRole(user.role) || tenantId !== userTenant) {
    throw new Error('Forbidden');
  }
}

function normalizeSnapshot(snapshot: {
  id: string;
  releaseId: string;
  title: string;
  subtitle: string | null;
  audience: string;
  status: string;
  contentJson: Prisma.JsonValue;
  createdAt: Date;
  publishedAt: Date | null;
}): InsightSnapshotRecord {
  return {
    id: snapshot.id,
    releaseId: snapshot.releaseId,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    audience: snapshot.audience as InsightSnapshotRecord['audience'],
    status: snapshot.status as InsightSnapshotRecord['status'],
    contentJson: snapshot.contentJson as InsightSnapshotContent,
    createdAt: snapshot.createdAt.toISOString(),
    publishedAt: snapshot.publishedAt ? snapshot.publishedAt.toISOString() : null,
  } satisfies InsightSnapshotRecord;
}

async function ensureStorage() {
  const available = await isTableAvailable('InsightSnapshot');
  if (!available) {
    throw new Error('InsightSnapshot table is not available. Run migrations first.');
  }
}

export async function listInsightSnapshots(): Promise<InsightSnapshotRecord[]> {
  await ensureStorage();

  const records = await prisma.insightSnapshot.findMany({ orderBy: { createdAt: 'desc' } });
  return records.map(normalizeSnapshot);
}

export async function getInsightSnapshotById(id: string): Promise<InsightSnapshotRecord | null> {
  await ensureStorage();

  const record = await prisma.insightSnapshot.findUnique({ where: { id } });
  return record ? normalizeSnapshot(record) : null;
}

export async function createInsightSnapshot({
  releaseId,
  templateKey,
  metricKey,
  filters,
  audience,
}: CreateSnapshotInput): Promise<InsightSnapshotRecord> {
  await ensureStorage();

  const release = getPublishedBenchmarkRelease(releaseId);
  if (!release) {
    throw new Error('Release must be published before creating an insight snapshot.');
  }

  if (!INSIGHT_AUDIENCES.includes(audience)) {
    throw new Error('Invalid audience specified.');
  }

  const content = await buildInsightSnapshot({ release, metricKey, templateKey, filters });

  const title = content.headline;
  const subtitle = content.subtitle ?? null;

  const created = await prisma.insightSnapshot.create({
    data: {
      releaseId,
      title,
      subtitle,
      audience,
      status: 'draft',
      contentJson: content as Prisma.JsonObject,
    },
  });

  return normalizeSnapshot(created);
}

export async function approveInsightSnapshot(id: string): Promise<InsightSnapshotRecord> {
  await ensureStorage();

  const existing = await prisma.insightSnapshot.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Snapshot not found');
  }

  if (existing.status !== 'draft') {
    throw new Error('Only draft snapshots can be approved.');
  }

  const updated = await prisma.insightSnapshot.update({
    where: { id },
    data: { status: 'approved' },
  });

  return normalizeSnapshot(updated);
}

export async function publishInsightSnapshot(id: string): Promise<InsightSnapshotRecord> {
  await ensureStorage();

  const existing = await prisma.insightSnapshot.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Snapshot not found');
  }

  if (existing.status !== 'approved') {
    throw new Error('Snapshots must be approved before publishing.');
  }

  const updated = await prisma.insightSnapshot.update({
    where: { id },
    data: { status: 'published', publishedAt: new Date() },
  });

  return normalizeSnapshot(updated);
}

export function buildSnapshotCsv(snapshot: InsightSnapshotRecord): string {
  const headers = ['id', 'releaseId', 'title', 'audience', 'status', 'createdAt', 'publishedAt', 'chartLabel', 'chartValue'];

  const rows = snapshot.contentJson.chart.series.map((series) => [
    snapshot.id,
    snapshot.releaseId,
    snapshot.title,
    snapshot.audience,
    snapshot.status,
    snapshot.createdAt,
    snapshot.publishedAt ?? '',
    series.label,
    series.value,
  ]);

  const csvBody = rows
    .map((row) =>
      row
        .map((value) => {
          const cell = `${value}`;
          return cell.includes(',') ? `"${cell}"` : cell;
        })
        .join(','),
    )
    .join('\n');

  return `${headers.join(',')}\n${csvBody}`;
}

export { listPublishedBenchmarkReleases };
