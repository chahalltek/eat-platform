import { NextRequest, NextResponse } from 'next/server';
<<<<<<< ours
import { runConfidence } from '@/src/lib/agents/confidence';
=======

import { runConfidence } from '@/lib/agents/confidence';
>>>>>>> theirs

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
<<<<<<< ours
    const jobId = params.jobId;
    const body = await req.json().catch(() => ({}));

    const recruiterId =
      body.recruiterId ?? 'recruiter@example.com'; // TODO: pull from auth later

    const result = await runConfidence({
      recruiterId,
      jobId,
=======
    const body = await req.json().catch(() => ({}));
    const recruiterId = body.recruiterId ?? 'recruiter@example.com';

    const result = await runConfidence({
      jobId: params.jobId,
      recruiterId,
>>>>>>> theirs
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
<<<<<<< ours
    console.error('CONFIDENCE API error:', err);
=======
    console.error('Job CONFIDENCE API error:', err);
>>>>>>> theirs
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
