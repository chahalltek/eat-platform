import { NextRequest, NextResponse } from 'next/server';
import { runConfidence } from '@/src/lib/agents/confidence';

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    const body = await req.json().catch(() => ({}));

    const recruiterId =
      body.recruiterId ?? 'recruiter@example.com'; // TODO: pull from auth later

    const result = await runConfidence({
      recruiterId,
      jobId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('CONFIDENCE API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
