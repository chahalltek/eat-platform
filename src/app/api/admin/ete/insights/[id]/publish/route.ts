import { NextRequest, NextResponse } from 'next/server';

import { assertAdminAccess, publishInsightSnapshot } from '@/lib/publishing/insightSnapshots';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminAccess(request);
    const { id } = await params;
    const snapshot = await publishInsightSnapshot(id);
    return NextResponse.json({ snapshot }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to publish insight snapshot';
    const status = message === 'Forbidden' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
