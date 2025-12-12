import { NextRequest, NextResponse } from 'next/server';

import { FireDrillAgentDisabledError } from '@/lib/agents/availability';
import { runShortlist } from '@/lib/agents/shortlist';
import { requireRecruiterOrAdmin } from '@/lib/auth/requireRole';

type RouteContext =
  | { params: { jobId: string } }
  | { params: Promise<{ jobId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const roleCheck = await requireRecruiterOrAdmin(req);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    const { jobId } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => ({}));

    const recruiterId =
      body.recruiterId ?? 'recruiter@example.com'; // TODO: auth later

    const result = await runShortlist({
      recruiterId,
      jobId,
      shortlistLimit: body.shortlistLimit,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof FireDrillAgentDisabledError) {
      return NextResponse.json(
        {
          errorCode: "FIRE_DRILL_MODE",
          message: "Shortlist agent is disabled in Fire Drill mode.",
        },
        { status: 503 },
      );
    }

    console.error('SHORTLIST API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
