// src/app/api/agents/rina/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runRina } from '@/lib/agents/rina';
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from '@/lib/agents/killSwitch';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { assertFeatureEnabled } from '@/lib/featureFlags/middleware';
import { isRateLimitError } from '@/lib/rateLimiting/rateLimiter';
import { toRateLimitResponse } from '@/lib/rateLimiting/http';
import { validateRecruiterId } from '@/app/api/agents/recruiterValidation';
import { getTenantScopedPrismaClient, toTenantErrorResponse } from '@/lib/agents/tenantScope';
import { normalizeRole, USER_ROLES, type UserRole } from '@/lib/auth/roles';
import { getCurrentTenantId } from '@/lib/tenant';
import { onCandidateChanged } from '@/lib/orchestration/triggers';
import { getCurrentUser } from '@/lib/auth/user';
import { DEFAULT_TENANT_ID } from '@/lib/auth/config';
import type { IdentityUser } from '@/lib/auth/identityProvider';

export async function POST(req: NextRequest) {
  try {
    const currentUser: IdentityUser =
      (await getCurrentUser(req)) ?? {
        id: 'anonymous-recruiter',
        tenantId: DEFAULT_TENANT_ID,
        role: USER_ROLES.RECRUITER,
        email: null,
        displayName: null,
      };

    const normalizedRole = normalizeRole(currentUser.role);
    const allowedRoles: UserRole[] = [
      USER_ROLES.ADMIN,
      USER_ROLES.SYSTEM_ADMIN,
      USER_ROLES.TENANT_ADMIN,
      USER_ROLES.RECRUITER,
    ];

    if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
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
    const flagCheck = await assertFeatureEnabled(FEATURE_FLAGS.AGENTS, { featureName: 'Agents' });

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
    const jobReqId = typeof body?.jobReqId === 'string' ? body.jobReqId.trim() : undefined;

    const recruiterValidation =
      (await validateRecruiterId(recruiterId ?? currentUser.id, { required: true })) ??
      { recruiterId: recruiterId ?? currentUser.id };

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

    const { prisma: scopedPrisma, runWithTenantContext } = scopedTenant;

    const result = await runWithTenantContext(() =>
      runRina({
        rawResumeText,
        sourceType,
        sourceTag,
        currentUser,
      }),
    );

    if (jobReqId) {
      const job = await scopedPrisma.jobReq.findUnique({
        where: { id: jobReqId, tenantId },
        select: { id: true, tenantId: true },
      });

      if (job) {
        void onCandidateChanged({
          tenantId: job.tenantId,
          jobId: job.id,
          candidateIds: [result.candidateId],
        });
      }
    }

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
