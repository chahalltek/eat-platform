// src/app/api/agents/rua/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runRua } from '@/lib/agents/rua';
import { validateRecruiterId } from '../recruiterValidation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { recruiterId, rawJobText, sourceType, sourceTag } = body ?? {};

    const recruiterValidation = await validateRecruiterId(recruiterId);

    if ('error' in recruiterValidation) {
      return NextResponse.json(
        { error: recruiterValidation.error },
        { status: recruiterValidation.status },
      );
    }

    if (!rawJobText || typeof rawJobText !== 'string') {
      return NextResponse.json(
        { error: 'rawJobText is required' },
        { status: 400 },
      );
    }

    const result = await runRua({
      recruiterId: recruiterValidation.recruiterId ?? undefined,
      rawJobText,
      sourceType,
      sourceTag,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('RUA API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
