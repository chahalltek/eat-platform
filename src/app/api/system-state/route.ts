import { NextResponse } from "next/server";

import { getSystemExecutionState, getSystemStatus } from "@/lib/systemStatus";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [statusMap, executionState] = await Promise.all([
      getSystemStatus(),
      getSystemExecutionState(),
    ]);

    return NextResponse.json({ statusMap, executionState });
  } catch (error) {
    console.error("[system-state] Failed to load system state", error);

    return NextResponse.json(
      {
        statusMap: {
          agents: { status: "unknown" },
          scoring: { status: "unknown" },
          database: { status: "unknown" },
          tenantConfig: { status: "unknown" },
        },
        executionState: {
          state: "degraded",
          activeRuns: 0,
          latestRunAt: null,
          latestSuccessAt: null,
          latestFailureAt: null,
<<<<<<< ours
          runsToday: 0,
=======
          latestFailureAgentName: null,
          failureCountLast24h: 0,
>>>>>>> theirs
        },
      },
      { status: 200 },
    );
  }
}
