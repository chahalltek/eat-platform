import { NextRequest, NextResponse } from 'next/server';

import { approveInsightSnapshot, assertAdminAccess } from '@/lib/publishing/insightSnapshots';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminAccess(request);
    const { id } = await context.params;
    const snapshot = await approveInsightSnapshot(id);
    return NextResponse.json({ snapshot }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve insight snapshot';
    const status = message === 'Forbidden' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
