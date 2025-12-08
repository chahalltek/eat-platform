import { NextRequest, NextResponse } from 'next/server';
import { runMatcher } from '@/lib/agents/matcher';

type RouteParams = { jobId: string };

type RouteContext = { params: RouteParams | Promise<RouteParams> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const jobId = params.jobId;
    const body = await req.json().catch(() => ({}));

    const recruiterId = body.recruiterId ?? 'recruiter@example.com';
    const topN = body.topN ?? 10;

    const result = await runMatcher({
      recruiterId,
      jobId,
      topN,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('Job MATCHER API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
