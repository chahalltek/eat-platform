import { NextRequest, NextResponse } from 'next/server';
import { runMatcher } from '@/lib/agents/matcher';
import { requireRole } from '@/lib/auth/requireRole';
import { USER_ROLES } from '@/lib/auth/roles';

// TODO: Add role/tenant-aware RBAC before allowing matcher runs.

export async function POST(req: NextRequest) {
  try {
    const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    const body = await req.json();

    const { recruiterId, jobId, topN } = body;

    if (!recruiterId || !jobId) {
      return NextResponse.json(
        { error: 'recruiterId and jobId are required' },
        { status: 400 }
      );
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
