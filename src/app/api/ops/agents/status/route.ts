import type { AgentRunStatus } from '@/server/db';
import { NextResponse } from 'next/server';

import { listAgentKillSwitches } from '@/lib/agents/killSwitch';
import { prisma } from '@/server/db';
import { requireRuntimeControlsAccess } from '@/lib/auth/runtimeControlsAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AgentTelemetry = {
  agentName: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  lastOutcome: AgentRunStatus | 'unknown';
  errorMessage: string | null;
};

export async function GET() {
  try {
    const access = await requireRuntimeControlsAccess();

    if (!access.ok) {
      return access.response;
    }

    const killSwitches = await listAgentKillSwitches();

    const telemetry = await Promise.all(
      killSwitches.map(async ({ agentName, latched }): Promise<AgentTelemetry> => {
        const latestRun = await prisma.agentRunLog.findFirst({
          where: { agentName, deletedAt: null },
          orderBy: [{ finishedAt: 'desc' }, { startedAt: 'desc' }],
        });

        const lastRunAt = latestRun?.finishedAt ?? latestRun?.startedAt ?? null;

        return {
          agentName,
          isEnabled: !latched,
          lastRunAt: lastRunAt?.toISOString() ?? null,
          lastOutcome: latestRun?.status ?? 'unknown',
          errorMessage: latestRun?.errorMessage ?? null,
        } satisfies AgentTelemetry;
      }),
    );

    return NextResponse.json({ agents: telemetry });
  } catch (error) {
    console.error('[ops/agents/status] Failed to fetch agent telemetry', error);
    return NextResponse.json({ agents: [] }, { status: 500 });
  }
}
