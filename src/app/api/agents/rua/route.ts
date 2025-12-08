// src/app/api/agents/rua/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runRua } from '@/lib/agents/rua';
import { getCurrentUser } from '@/lib/auth/user';
import { agentFeatureGuard } from '@/lib/featureFlags/middleware';
import { validateRecruiterId } from '../recruiterValidation';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flagCheck = await agentFeatureGuard();

    if (flagCheck) {
      return flagCheck;
    }

    const body = await req.json();

    const { recruiterId, rawJobText, sourceType, sourceTag } = body ?? {};

    const recruiterValidation = await validateRecruiterId(
      recruiterId ?? currentUser.id,
      { required: true },
    );

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
