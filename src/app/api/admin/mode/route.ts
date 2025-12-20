import { NextResponse, type NextRequest } from "next/server";

import { logModeChange } from "@/lib/audit/adminAudit";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { SYSTEM_MODES, type SystemModeName } from "@/lib/modes/systemModes";
import { prisma } from "@/server/db/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { getTenantMode, updateTenantMode } from "@/lib/tenantMode";

export const dynamic = "force-dynamic";

const VALID_MODES = Object.keys(SYSTEM_MODES) as SystemModeName[];

function parseMode(raw: unknown): SystemModeName | null {
  if (typeof raw !== "string") return null;

  const normalized = raw.trim().toLowerCase();
  return VALID_MODES.includes(normalized as SystemModeName)
    ? (normalized as SystemModeName)
    : null;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!canManageFeatureFlags(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await getCurrentTenantId(request);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const mode = await getTenantMode(tenantId);

  return NextResponse.json({ tenant: { ...tenant, mode } });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!canManageFeatureFlags(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = parseMode(body?.mode);

  if (!mode) {
    return NextResponse.json({ error: "mode is required" }, { status: 400 });
  }

  const tenantId = await getCurrentTenantId(request);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const previousMode = await getTenantMode(tenantId);
  const updated = await updateTenantMode(tenantId, mode);

  await logModeChange({
    tenantId,
    actorId: user?.id ?? null,
    previousMode,
    newMode: mode,
  });

  return NextResponse.json({ tenant: updated });
}
