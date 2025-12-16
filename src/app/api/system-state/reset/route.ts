import { NextResponse } from "next/server";

import { getRedactedExecutionState, getRedactedSystemStatus, isPublicDemoMode } from "@/lib/demoMode";
import { getCurrentTenantId } from "@/lib/tenant";
import { AgentRunStatus } from "@/server/db";
import { prisma } from "@/lib/prisma";
import { getSystemExecutionState, getSystemStatus } from "@/lib/systemStatus";
import { requireRuntimeControlsAccess } from "@/lib/auth/runtimeControlsAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    const access = await requireRuntimeControlsAccess();

    if (!access.ok) {
      return access.response;
    }

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
