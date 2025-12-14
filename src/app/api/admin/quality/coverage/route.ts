import { NextResponse, type NextRequest } from 'next/server';

import { recordCoverageReport } from '@/lib/metrics/quality';
import { getQualityIngestToken } from '@/server/config/secrets';

export async function POST(request: NextRequest) {
  const ingestToken = getQualityIngestToken();

  if (ingestToken) {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token !== ingestToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { coveragePercent, branch, commitSha } = (body ?? {}) as {
    coveragePercent?: unknown;
    branch?: string;
    commitSha?: string;
  };

  if (!Number.isFinite(coveragePercent as number)) {
    return NextResponse.json({ error: 'coveragePercent must be provided as a number' }, { status: 400 });
  }

  try {
    const report = await recordCoverageReport({
      coveragePercent: coveragePercent as number,
      branch,
      commitSha,
    });

    return NextResponse.json(
      {
        id: report.id,
        branch: report.branch,
        commitSha: report.commitSha,
        coveragePercent: report.coveragePercent,
        createdAt: report.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[quality] Failed to record coverage report', error);
    return NextResponse.json({ error: 'Failed to record coverage report' }, { status: 500 });
  }
}
