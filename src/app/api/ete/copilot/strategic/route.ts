import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/requireRole";
import { isAdminRole, USER_ROLES } from "@/lib/auth/roles";
import { gatherEvidence } from "@/lib/copilot/gatherEvidence";
import {
  generateStrategicCopilotResponse,
  recordCopilotAudit,
  type CopilotRequest,
} from "@/lib/copilot/strategicCopilot";

export async function POST(request: NextRequest) {
  const roleCheck = await requireRole(request, [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN, USER_ROLES.EXEC]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let body: Partial<CopilotRequest> = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const roleFamily = typeof body.scope?.roleFamily === "string" ? body.scope.roleFamily.trim() : "";
  const normalizedRoleFamily = roleFamily.length > 0 ? roleFamily : undefined;
  const horizonDays = body.scope?.horizonDays;
  const resolvedHorizon: 30 | 60 | 90 = horizonDays === 60 || horizonDays === 90 ? horizonDays : 30;

  const scope: CopilotRequest["scope"] = { roleFamily: normalizedRoleFamily, horizonDays: resolvedHorizon };

  const copilotRequest: CopilotRequest = {
    tenantId: roleCheck.user.tenantId ?? "default-tenant",
    userId: roleCheck.user.id,
    query,
    scope,
  };

  const evidencePack = await gatherEvidence({
    tenantId: copilotRequest.tenantId,
    scope: copilotRequest.scope,
    bypassCache: isAdminRole(roleCheck.user.role),
  });
  const response = await generateStrategicCopilotResponse({ request: copilotRequest, evidencePack });

  try {
    await recordCopilotAudit({
      tenantId: copilotRequest.tenantId,
      userId: copilotRequest.userId,
      query: copilotRequest.query,
      response,
      evidence: response.evidence,
    });
  } catch (error) {
    console.error("[strategic-copilot] Failed to record audit", error);
  }

  return NextResponse.json(response satisfies typeof response);
}
