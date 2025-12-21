import { NextRequest, NextResponse } from "next/server";

import { FireDrillAgentDisabledError } from "@/lib/agents/availability";
import { runConfidence } from "@/lib/agents/confidence";
import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { getCurrentTenantId } from "@/lib/tenant";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { USER_ROLES } from "@/lib/auth/roles";

type RouteParams = { jobReqId: string };

type RouteContext = { params: RouteParams | Promise<RouteParams> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const roleCheck = await requireRecruiterOrAdmin(req);

    if (!roleCheck.ok) {
      return roleCheck.response;
    }

    const tenantIdFromRequest = await getCurrentTenantId(req);
    const permissionUser = {
      ...roleCheck.user,
      role: roleCheck.user.role ?? USER_ROLES.RECRUITER,
      tenantId: roleCheck.user.tenantId ?? tenantIdFromRequest ?? DEFAULT_TENANT_ID,
    };
    const tenantId =
      tenantIdFromRequest === DEFAULT_TENANT_ID && roleCheck.user.tenantId
        ? roleCheck.user.tenantId
        : tenantIdFromRequest ?? permissionUser.tenantId ?? DEFAULT_TENANT_ID;

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
