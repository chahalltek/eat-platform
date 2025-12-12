import { NextRequest, NextResponse } from "next/server";

import {
  describeAgentKillSwitch,
  listAgentKillSwitches,
  parseAgentName,
  setAgentKillSwitch,
} from "@/lib/agents/killSwitch";
import { logAgentFlagToggle } from "@/lib/audit/adminAudit";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!canManageFeatureFlags(user)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user } as const;
  }

  return { response: null, user } as const;
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);

  if (response) {
    return response;
  }

  const tenantId = await getCurrentTenantId(request);
  const killSwitches = await listAgentKillSwitches(tenantId);

  return NextResponse.json(killSwitches);
}

export async function PATCH(request: NextRequest) {
  const { response, user } = await requireAdmin(request);

  if (response) {
    return response;
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

  const tenantId = await getCurrentTenantId(request);
  const updated = await setAgentKillSwitch(parsedName, latched, typeof reason === "string" ? reason : null, tenantId);

  await logAgentFlagToggle({
    tenantId,
    actorId: user?.id ?? null,
    agentName: parsedName,
    latched: updated.latched,
    reason: updated.reason,
    latchedAt: updated.latchedAt?.toISOString() ?? null,
  });

  return NextResponse.json({
    ...updated,
    agentLabel: describeAgentKillSwitch(parsedName),
  });
}
