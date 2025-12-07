// src/app/api/agents/rina/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runRina } from '@/lib/agents/rina';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { recruiterId, rawResumeText, sourceType, sourceTag } = body ?? {};

    if (typeof rawResumeText !== 'string') {
      return NextResponse.json(
        { error: 'rawResumeText is required' },
        { status: 400 },
      );
    }

    const trimmedResumeText = rawResumeText.trim();
    const MAX_RESUME_LENGTH = 16000;

    if (!trimmedResumeText) {
      return NextResponse.json(
        { error: 'rawResumeText is required' },
        { status: 400 },
      );
    }

    if (trimmedResumeText.length > MAX_RESUME_LENGTH) {
      return NextResponse.json(
        { error: `rawResumeText must be at most ${MAX_RESUME_LENGTH} characters` },
        { status: 400 },
      );
    }

    const result = await runRina({
      recruiterId,
      rawResumeText,
      sourceType,
      sourceTag,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('RINA API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
