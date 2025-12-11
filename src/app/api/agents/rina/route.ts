// src/app/api/agents/rina/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runRina } from '@/lib/agents/rina';
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from '@/lib/agents/killSwitch';
import { agentFeatureGuard } from '@/lib/featureFlags/middleware';
import { isRateLimitError } from '@/lib/rateLimiting/rateLimiter';
import { toRateLimitResponse } from '@/lib/rateLimiting/http';
import { validateRecruiterId } from '../recruiterValidation';
import { getTenantScopedPrismaClient, toTenantErrorResponse } from '@/lib/agents/tenantScope';
import { requireRole } from '@/lib/auth/requireRole';
import { USER_ROLES } from '@/lib/auth/roles';
import { getCurrentTenantId } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    let scopedTenant;
    try {
      scopedTenant = await getTenantScopedPrismaClient(req);
    } catch (error) {
      const tenantError = toTenantErrorResponse(error);

      if (tenantError) {
        return tenantError;
      }

      throw error;
    }
    const currentUser = roleCheck.user;

    const flagCheck = await agentFeatureGuard();

    if (flagCheck) {
      return flagCheck;
    }

    const tenantId = await getCurrentTenantId(req);
    const killSwitchResponse = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.RINA, tenantId);

    if (killSwitchResponse) {
      return killSwitchResponse;
    }

    const body = await req.json();

    const { recruiterId, rawResumeText, sourceType, sourceTag } = body ?? {};

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

    const result = await scopedTenant.runWithTenantContext(() =>
      runRina({
        rawResumeText,
        sourceType,
        sourceTag,
      }),
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (isRateLimitError(err)) {
      return toRateLimitResponse(err);
    }

    console.error('RINA API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
