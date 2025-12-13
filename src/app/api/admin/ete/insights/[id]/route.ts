import { NextRequest, NextResponse } from 'next/server';

import { assertAdminAccess, getInsightSnapshotById } from '@/lib/publishing/insightSnapshots';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await assertAdminAccess(request);
    const snapshot = await getInsightSnapshotById(params.id);

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    return NextResponse.json({ snapshot }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load insight snapshot';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
