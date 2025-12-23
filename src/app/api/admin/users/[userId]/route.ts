import { NextResponse, type NextRequest } from "next/server";

import { canManageRbac } from "@/lib/auth/permissions";
import { normalizeRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const TENANT_ROLE_VALUES = new Set(["TENANT_ADMIN", "RECRUITER"]);

function parseTenantRole(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();

  if (!normalized || normalized === "NONE") {
    return null;
  }

  return TENANT_ROLE_VALUES.has(normalized) ? normalized : undefined;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const normalizedUserId = userId?.trim();
  const actor = await getCurrentUser(request);
  const tenantId = await getCurrentTenantId(request);

  if (!canManageRbac(actor, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!normalizedUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const body = await request.json();
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : undefined;
  const role = body?.role !== undefined ? normalizeRole(body?.role ?? null) : undefined;
  const tenantRole = parseTenantRole(body?.tenantRole ?? undefined);

  if (body?.role !== undefined && !role) {
    return NextResponse.json({ error: "role is invalid" }, { status: 400 });
  }

  if (body?.tenantRole !== undefined && tenantRole === undefined) {
    return NextResponse.json({ error: "tenantRole is invalid" }, { status: 400 });
  }

  if (displayName !== undefined && !displayName) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const userUpdate = await tx.user.update({
        where: { id: normalizedUserId },
        data: {
          ...(role ? { role } : null),
          ...(displayName ? { displayName } : null),
        },
      });

      if (tenantRole !== undefined) {
        if (tenantRole === null) {
          await tx.tenantUser.deleteMany({
            where: { userId: normalizedUserId, tenantId },
          });
        } else {
          await tx.tenantUser.upsert({
            where: { userId_tenantId: { userId: normalizedUserId, tenantId } },
            update: { role: tenantRole },
            create: { userId: normalizedUserId, tenantId, role: tenantRole },
          });
        }
      }

      return userUpdate;
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
        tenantId: updated.tenantId,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.warn("Failed to update user access", error);
    return NextResponse.json({ error: "Unable to update user" }, { status: 500 });
  }
}
