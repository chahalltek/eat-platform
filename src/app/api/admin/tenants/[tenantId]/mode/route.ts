import { NextResponse, type NextRequest } from "next/server";
import { TenantMode } from "@prisma/client";

import { canManageTenants } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { getTenantMode, updateTenantMode } from "@/lib/tenantMode";

export const dynamic = "force-dynamic";

function parseMode(raw: unknown): TenantMode | null {
  if (typeof raw !== "string") return null;

  const normalized = raw.toUpperCase();
  return (Object.values(TenantMode) as string[]).includes(normalized) ? (normalized as TenantMode) : null;
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

  const mode = await getTenantMode(tenantId);

  if (!mode) {
    const tenantExists = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

    if (!tenantExists) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
  }

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
