import { NextResponse } from "next/server";

import { getRedactedExecutionState, getRedactedSystemStatus, isPublicDemoMode } from "@/lib/demoMode";
import { normalizeRole, isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { AgentRunStatus } from "@/server/db";
import { prisma } from "@/lib/prisma";
import { getSystemExecutionState, getSystemStatus } from "@/lib/systemStatus";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    if (isPublicDemoMode()) {
      return NextResponse.json(
        {
          statusMap: getRedactedSystemStatus(),
          executionState: getRedactedExecutionState(),
          error: "System reset unavailable in demo mode",
        },
        { status: 403 },
      );
    }

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = normalizeRole(user.role);

    if (!role || !isAdminRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = await getCurrentTenantId();

    await prisma.agentRunLog.updateMany({
      where: { tenantId, status: AgentRunStatus.FAILED, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    const [statusMap, executionState] = await Promise.all([
      getSystemStatus(),
      getSystemExecutionState(),
    ]);

    return NextResponse.json({ statusMap, executionState });
  } catch (error) {
    console.error("[system-state-reset] Failed to reset execution state", error);

    return NextResponse.json({ error: "Failed to reset system state" }, { status: 500 });
  }
}
