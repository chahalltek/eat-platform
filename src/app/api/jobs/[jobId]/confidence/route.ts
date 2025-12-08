import { NextRequest, NextResponse } from 'next/server';
import { runConfidence } from '@/lib/agents/confidence';

type RouteParams = { jobId: string };

type RouteContext = { params: RouteParams | Promise<RouteParams> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const body = await req.json().catch(() => ({}));
    const recruiterId = body.recruiterId ?? 'recruiter@example.com';

    const result = await runConfidence({
      jobId: params.jobId,
      recruiterId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('Job CONFIDENCE API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
