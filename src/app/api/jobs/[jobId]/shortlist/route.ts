import { NextRequest, NextResponse } from 'next/server';
import { runShortlist } from '@/src/lib/agents/shortlist';

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    const body = await req.json().catch(() => ({}));

    const recruiterId =
      body.recruiterId ?? 'recruiter@example.com'; // TODO: auth later

    const result = await runShortlist({
      recruiterId,
      jobId,
      minMatchScore: body.minMatchScore,
      minConfidence: body.minConfidence,
      maxShortlisted: body.maxShortlisted,
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
