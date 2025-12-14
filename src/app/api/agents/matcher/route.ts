import { NextRequest, NextResponse } from 'next/server';
import { runMatcher } from '@/lib/agents/matcher';
import { requireRole } from '@/lib/auth/requireRole';
import { normalizeRole, USER_ROLES } from '@/lib/auth/roles';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { assertFeatureEnabled } from '@/lib/featureFlags/middleware';
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from '@/lib/agents/killSwitch';
import { getCurrentTenantId } from '@/lib/tenant';
import { prisma } from '@/server/db';

export async function POST(req: NextRequest) {
  try {
    const roleCheck = await requireRole(req, [
      USER_ROLES.ADMIN,
      USER_ROLES.SYSTEM_ADMIN,
      USER_ROLES.TENANT_ADMIN,
      USER_ROLES.RECRUITER,
    ]);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    const featureGuard = await assertFeatureEnabled(FEATURE_FLAGS.AGENTS, { featureName: 'Agents' });

    if (featureGuard) {
      return featureGuard;
    }

    const body = await req.json();

    const { recruiterId, jobId, topN } = body;

    if (!recruiterId || !jobId) {
      return NextResponse.json(
        { error: 'recruiterId and jobId are required' },
        { status: 400 }
      );
    }

    const tenantId = await getCurrentTenantId(req);
    const userRole = normalizeRole(roleCheck.user.role);
    const isSystemAdmin = userRole === USER_ROLES.SYSTEM_ADMIN;

    const job = await prisma.jobReq.findUnique({ select: { tenantId: true }, where: { id: jobId } });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!isSystemAdmin && job.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const killSwitchResponse = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.MATCHER, tenantId);

    if (killSwitchResponse) {
      return killSwitchResponse;
    }

    const result = await runMatcher({
      recruiterId,
      jobId,
      topN,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('MATCHER API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
