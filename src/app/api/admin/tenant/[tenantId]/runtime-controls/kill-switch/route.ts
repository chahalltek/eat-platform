import { NextResponse, type NextRequest } from "next/server";

import { canManageTenants } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import {
  describeKillSwitch,
  getKillSwitchState,
  KILL_SWITCHES,
  latchKillSwitch,
  resetKillSwitch,
  type KillSwitchName,
} from "@/lib/killSwitch";
import { logKillSwitchToggle } from "@/lib/audit/adminAudit";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const VALID_KEYS = new Set<KillSwitchName>(Object.values(KILL_SWITCHES));

function parseKillSwitchKey(raw: unknown): KillSwitchName | null {
  if (typeof raw !== "string") return null;

  const normalized = raw.trim() as KillSwitchName;
  return VALID_KEYS.has(normalized) ? normalized : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const roleHint = getTenantRoleFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageTenants(user)) {
    const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key, latched, reason } = (body ?? {}) as {
    key?: unknown;
    latched?: unknown;
    reason?: unknown;
  };

  const parsedKey = parseKillSwitchKey(key);

  if (!parsedKey || typeof latched !== "boolean") {
    return NextResponse.json({ error: "key and latched are required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const latchedReason = typeof reason === "string" ? reason : undefined;
  const state = latched
    ? latchKillSwitch(parsedKey, latchedReason)
    : (resetKillSwitch(parsedKey), getKillSwitchState(parsedKey));

  await logKillSwitchToggle({
    tenantId,
    actorId: user.id ?? null,
    key: parsedKey,
    latched: state.latched,
    reason: state.latched ? state.reason : null,
    latchedAt: state.latched ? state.latchedAt.toISOString() : null,
  });

  return NextResponse.json({
    key: parsedKey,
    label: describeKillSwitch(parsedKey),
    state: {
      ...state,
      latchedAt: state.latched ? state.latchedAt.toISOString() : null,
    },
  });
}
