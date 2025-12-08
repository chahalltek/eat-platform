import { NextRequest, NextResponse } from "next/server";

import {
  describeAgentKillSwitch,
  listAgentKillSwitches,
  parseAgentName,
  setAgentKillSwitch,
} from "@/lib/agents/killSwitch";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!canManageFeatureFlags(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const guardResponse = await requireAdmin(request);

  if (guardResponse) {
    return guardResponse;
  }

  const killSwitches = await listAgentKillSwitches();

  return NextResponse.json(killSwitches);
}

export async function PATCH(request: NextRequest) {
  const guardResponse = await requireAdmin(request);

  if (guardResponse) {
    return guardResponse;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agentName, latched, reason } = (body ?? {}) as {
    agentName?: unknown;
    latched?: unknown;
    reason?: unknown;
  };

  const parsedName = parseAgentName(agentName);

  if (!parsedName || typeof latched !== "boolean") {
    return NextResponse.json({ error: "agentName and latched are required" }, { status: 400 });
  }

  const updated = await setAgentKillSwitch(parsedName, latched, typeof reason === "string" ? reason : null);

  return NextResponse.json({
    ...updated,
    agentLabel: describeAgentKillSwitch(parsedName),
  });
}
