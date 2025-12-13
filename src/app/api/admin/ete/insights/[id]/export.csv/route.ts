import { NextRequest, NextResponse } from 'next/server';

import { assertAdminAccess, buildSnapshotCsv, getInsightSnapshotById } from '@/lib/publishing/insightSnapshots';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await assertAdminAccess(request);
    const snapshot = await getInsightSnapshotById(params.id);

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    const csv = buildSnapshotCsv(snapshot);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="insight-${snapshot.id}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export insight snapshot';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
