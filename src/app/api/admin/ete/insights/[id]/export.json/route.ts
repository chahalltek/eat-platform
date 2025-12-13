import { NextRequest, NextResponse } from 'next/server';

import { assertAdminAccess, getInsightSnapshotById } from '@/lib/publishing/insightSnapshots';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminAccess(request);
    const { id } = await params;
    const snapshot = await getInsightSnapshotById(id);

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    return NextResponse.json(snapshot.contentJson, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="insight-${snapshot.id}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export insight snapshot';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
