import { NextRequest, NextResponse } from 'next/server';

import { assertAdminAccess, createInsightSnapshot, listInsightSnapshots } from '@/lib/publishing/insightSnapshots';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await assertAdminAccess(request);
    const snapshots = await listInsightSnapshots();
    return NextResponse.json({ snapshots }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to list insight snapshots';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await assertAdminAccess(request);

    const body = await request.json();
    const snapshot = await createInsightSnapshot({
      releaseId: body.releaseId,
      templateKey: body.templateKey ?? body.metricKey,
      metricKey: body.metricKey,
      filters: body.filters,
      audience: body.audience,
    });

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create insight snapshot';
    const status = message === 'Forbidden' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
