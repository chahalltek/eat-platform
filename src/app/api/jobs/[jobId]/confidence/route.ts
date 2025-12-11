import { NextRequest, NextResponse } from "next/server";

import { FireDrillAgentDisabledError } from "@/lib/agents/availability";
import { runConfidence } from "@/lib/agents/confidence";
import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";

type RouteParams = { jobId: string };

type RouteContext = { params: RouteParams | Promise<RouteParams> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    const params = await context.params;
    const body = await req.json().catch(() => ({}));
    const recruiterId = body.recruiterId ?? 'recruiter@example.com';

    const result = await runConfidence({
      jobId: params.jobId,
      recruiterId,
    }, req);

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
