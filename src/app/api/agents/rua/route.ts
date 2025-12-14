// src/app/api/agents/rua/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runRua } from '@/lib/agents/rua';
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from '@/lib/agents/killSwitch';
import { getCurrentUser } from '@/lib/auth/user';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { assertFeatureEnabled } from '@/lib/featureFlags/middleware';
import { toRateLimitResponse } from '@/lib/rateLimiting/http';
import { isRateLimitError } from '@/lib/rateLimiting/rateLimiter';
import { validateRecruiterId } from '../recruiterValidation';
import { getCurrentTenantId } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flagCheck = await assertFeatureEnabled(FEATURE_FLAGS.AGENTS, { featureName: 'Agents' });

    if (flagCheck) {
      return flagCheck;
    }

    const tenantId = await getCurrentTenantId(req);
    const killSwitchResponse = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.RUA, tenantId);

    if (killSwitchResponse) {
      return killSwitchResponse;
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
    if (isRateLimitError(err)) {
      return toRateLimitResponse(err);
    }

    console.error('RUA API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
