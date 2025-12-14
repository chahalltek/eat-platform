import { NextResponse } from "next/server";

import { describeKillSwitch, getKillSwitchState, KillSwitchName } from "@/lib/killSwitch";
import { logExecutionBlocked } from "@/server/audit/logger";

type KillSwitchMiddlewareContext = {
  componentName?: string;
  fallbackStatus?: number;
};

export function enforceKillSwitch(name: KillSwitchName, context: KillSwitchMiddlewareContext = {}) {
  const state = getKillSwitchState(name);

  if (!state.latched) return null;

  const label = context.componentName ?? describeKillSwitch(name);
  const status = context.fallbackStatus ?? 503;

  logExecutionBlocked({
    featureFlag: name,
    reason: state.reason,
  });

  return NextResponse.json(
    {
      error: `${label} is currently disabled`,
      reason: state.reason,
      latchedAt: state.latchedAt.toISOString(),
    },
    { status },
  );
}
