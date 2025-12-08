// src/app/api/agents/outreach/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { runOutreach } from '@/lib/agents/outreach';

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch (err) {
    console.error('OUTREACH API invalid JSON:', err);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const { recruiterId, candidateId, jobReqId } = (body ?? {}) as {
      recruiterId?: unknown;
      candidateId?: unknown;
      jobReqId?: unknown;
    };

    const trimmedRecruiterId = typeof recruiterId === 'string' ? recruiterId.trim() : '';
    const trimmedCandidateId = typeof candidateId === 'string' ? candidateId.trim() : '';
    const trimmedJobReqId = typeof jobReqId === 'string' ? jobReqId.trim() : '';

    if (!trimmedRecruiterId) {
      return NextResponse.json(
        { error: 'recruiterId is required and must be a string' },
        { status: 400 },
      );
    }

    if (!trimmedCandidateId) {
      return NextResponse.json(
        { error: 'candidateId is required and must be a string' },
        { status: 400 },
      );
    }

    if (!trimmedJobReqId) {
      return NextResponse.json(
        { error: 'jobReqId is required and must be a string' },
        { status: 400 },
      );
    }

    console.log('OUTREACH API request:', {
      recruiterId: trimmedRecruiterId,
      candidateId: trimmedCandidateId,
      jobReqId: trimmedJobReqId,
    });

    const result = await runOutreach({
      recruiterId: trimmedRecruiterId,
      candidateId: trimmedCandidateId,
      jobReqId: trimmedJobReqId,
    });

    console.log('OUTREACH API success:', {
      agentRunId: result.agentRunId,
      recruiterId: trimmedRecruiterId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('OUTREACH API error:', err);

    const message = err instanceof Error ? err.message : 'Unknown error';
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('llm')) {
      return NextResponse.json(
        { error: 'Outreach agent temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }

    if (normalizedMessage.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
