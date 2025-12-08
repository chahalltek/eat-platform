import { NextRequest, NextResponse } from 'next/server';
import { runMatcher } from '@/lib/agents/matcher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { recruiterId, jobId, topN } = body;

    if (!recruiterId || !jobId) {
      return NextResponse.json(
        { error: 'recruiterId and jobId are required' },
        { status: 400 }
      );
    }

    const result = await runMatcher({
      recruiterId,
      jobId,
      topN,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('MATCHER API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
