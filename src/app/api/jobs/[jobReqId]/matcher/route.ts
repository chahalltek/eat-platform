import { NextRequest, NextResponse } from 'next/server';

import { runMatcher } from '@/lib/agents/matcher';
import { getCurrentUser } from '@/lib/auth';
import { requireRecruiterOrAdmin } from '@/lib/auth/requireRole';

type RouteParams = { jobReqId: string };

type RouteContext = { params: RouteParams | Promise<RouteParams> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleCheck = await requireRecruiterOrAdmin(req);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    const params = await context.params;
    const jobId = params.jobReqId;
    const body = await req.json().catch(() => ({}));

    const recruiterId = currentUser.id ?? roleCheck.user.id ?? body.recruiterId ?? 'recruiter@example.com';
    const topN = body.topN ?? 10;

    const result = await runMatcher({
      recruiterId,
      jobId,
      topN,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('Job MATCHER API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
