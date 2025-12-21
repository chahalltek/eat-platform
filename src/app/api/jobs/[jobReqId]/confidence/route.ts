import { NextRequest, NextResponse } from "next/server";

import { FireDrillAgentDisabledError } from "@/lib/agents/availability";
import { runConfidence } from "@/lib/agents/confidence";
import { canRunAgentConfidence } from "@/lib/auth/permissions";
import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { getCurrentTenantId } from "@/lib/tenant";

type RouteParams = { jobReqId: string };

type RouteContext = { params: RouteParams | Promise<RouteParams> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const roleCheck = await requireRecruiterOrAdmin(req);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    const tenantId = await getCurrentTenantId(req);

    if (!canRunAgentConfidence(roleCheck.user, tenantId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await context.params;
    const body = await req.json().catch(() => ({}));
    const recruiterId = body.recruiterId ?? 'recruiter@example.com';

    const result = await runConfidence(
      {
        jobId: params.jobReqId,
        recruiterId,
      },
      req,
    );

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

    console.error('Job CONFIDENCE API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
