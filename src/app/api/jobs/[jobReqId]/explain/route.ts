import { NextRequest, NextResponse } from 'next/server';

import { FireDrillAgentDisabledError } from '@/lib/agents/availability';
import { runExplainForJob } from '@/lib/agents/explain';
import { requireRecruiterOrAdmin } from '@/lib/auth/requireRole';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobReqId: string }> }
) {
  try {
    const roleCheck = await requireRecruiterOrAdmin(req);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    const { jobReqId } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await runExplainForJob({
      jobId: jobReqId,
      candidateIds: Array.isArray(body.candidateIds) ? body.candidateIds : undefined,
      tenantId: typeof body.tenantId === "string" ? body.tenantId : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof FireDrillAgentDisabledError) {
      return NextResponse.json(
        {
          errorCode: "FIRE_DRILL_MODE",
          message: "Explain/Confidence agents are disabled in Fire Drill mode.",
        },
        { status: 503 },
      );
    }

    console.error('EXPLAIN API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
