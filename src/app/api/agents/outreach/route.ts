// src/app/api/agents/outreach/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { runOutreach } from '@/lib/agents/outreach';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recruiterId, candidateId, jobReqId } = body ?? {};

    if (!candidateId || typeof candidateId !== 'string') {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 });
    }

    if (!jobReqId || typeof jobReqId !== 'string') {
      return NextResponse.json({ error: 'jobReqId is required' }, { status: 400 });
    }

    const result = await runOutreach({ recruiterId, candidateId, jobReqId });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('OUTREACH API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
