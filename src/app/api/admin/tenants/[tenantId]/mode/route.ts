import { NextResponse, type NextRequest } from "next/server";

import { canManageTenants } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { SYSTEM_MODES, type SystemModeName } from "@/lib/modes/systemModes";
import { prisma } from "@/lib/prisma";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);

  if (!canManageTenants(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantExists = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenantExists) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const mode = await getTenantMode(tenantId);

  return NextResponse.json({ tenantId, mode });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);

  if (!canManageTenants(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = parseMode(body?.mode);

  if (!mode) {
    return NextResponse.json({ error: "mode is required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const updated = await updateTenantMode(tenantId, mode);

  return NextResponse.json({ tenant: updated });
}
