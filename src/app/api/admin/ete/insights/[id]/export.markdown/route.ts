import { NextRequest, NextResponse } from 'next/server';

import { assertAdminAccess, getInsightSnapshotById } from '@/lib/publishing/insightSnapshots';
import { renderInsightMarkdown } from '@/lib/publishing/renderInsightContent';

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

    const markdown = renderInsightMarkdown(snapshot);

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="insight-${snapshot.id}.md"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export insight snapshot';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
