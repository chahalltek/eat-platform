import { NextRequest, NextResponse } from 'next/server';
import { runExplainForJob } from '@/lib/agents/explain';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = await req.json().catch(() => ({}));

    const recruiterId =
      body.recruiterId ?? 'recruiter@example.com'; // TODO: auth later
    const maxMatches = body.maxMatches ?? 20;

    const result = await runExplainForJob({
      recruiterId,
      jobId,
      maxMatches,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('EXPLAIN API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
