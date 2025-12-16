import { NextResponse, type NextRequest } from "next/server";

import { canManageTenants } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { logModeChange } from "@/lib/audit/adminAudit";
import { SYSTEM_MODES, type SystemModeName } from "@/lib/modes/systemModes";
import { prisma } from "@/server/db";
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
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

  const mode = parseMode((body as { mode?: unknown })?.mode);

  if (!mode) {
    return NextResponse.json({ error: "mode is required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const previousMode = await getTenantMode(tenantId);
  const updated = await updateTenantMode(tenantId, mode);

  await logModeChange({
    tenantId,
    actorId: user.id,
    previousMode,
    newMode: mode,
  });

  return NextResponse.json({ tenant: updated });
}
