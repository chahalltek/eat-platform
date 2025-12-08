import { NextRequest, NextResponse } from 'next/server';
import { runShortlist } from '@/lib/agents/shortlist';

type RouteContext =
  | { params: { jobId: string } }
  | { params: Promise<{ jobId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => ({}));

    const recruiterId =
      body.recruiterId ?? 'recruiter@example.com'; // TODO: auth later

    const result = await runShortlist({
      recruiterId,
      jobId,
      shortlistLimit: body.shortlistLimit,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('SHORTLIST API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
