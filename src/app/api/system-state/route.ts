import { NextResponse } from "next/server";

import { getSystemExecutionState, getSystemStatus } from "@/lib/systemStatus";
import { getRedactedExecutionState, getRedactedSystemStatus, isPublicDemoMode } from "@/lib/demoMode";
import { requireRuntimeControlsAccess } from "@/lib/auth/runtimeControlsAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const access = await requireRuntimeControlsAccess();

    if (!access.ok) {
      return access.response;
    }

    if (isPublicDemoMode()) {
      return NextResponse.json({
        statusMap: getRedactedSystemStatus(),
        executionState: getRedactedExecutionState(),
      });
    }

    const [statusMap, executionState] = await Promise.all([
      getSystemStatus(),
      getSystemExecutionState(),
    ]);

    return NextResponse.json({ statusMap, executionState });
  } catch (error) {
    console.error("[system-state] Failed to load system state", error);

    return NextResponse.json(
      {
        statusMap: getRedactedSystemStatus(),
        executionState: getRedactedExecutionState(),
      },
      { status: 200 },
    );
  }
}
