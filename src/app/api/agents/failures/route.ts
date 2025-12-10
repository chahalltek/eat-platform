import { NextRequest, NextResponse } from "next/server";

import { getAgentFailureCount } from "@/lib/agents/failures";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getCurrentTenantId(req);
  const failedRuns = await getAgentFailureCount(tenantId);

  return NextResponse.json({ failedRuns });
}
