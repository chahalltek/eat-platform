import { NextResponse, type NextRequest } from "next/server";

import { canManageRbac } from "@/lib/auth/permissions";
import { normalizeRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { listUsersForTenant } from "@/lib/admin/users";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const TENANT_ROLE_VALUES = new Set(["TENANT_ADMIN", "RECRUITER"]);

function parseTenantRole(value: unknown) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (!normalized || normalized === "NONE") {
    return null;
  }

  return TENANT_ROLE_VALUES.has(normalized) ? normalized : null;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  const tenantId = await getCurrentTenantId(request);

  if (!canManageRbac(user, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listUsersForTenant(tenantId);

  return NextResponse.json({
    users: users.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  const tenantId = await getCurrentTenantId(request);

  if (!canManageRbac(user, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const role = normalizeRole(body?.role ?? null);
  const tenantRole = parseTenantRole(body?.tenantRole ?? null);

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  if (!displayName) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  if (!role) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          displayName,
          role,
          tenantId,
        },
      });

      if (tenantRole) {
        await tx.tenantUser.upsert({
          where: {
            userId_tenantId: { userId: newUser.id, tenantId },
          },
          update: { role: tenantRole },
          create: {
            userId: newUser.id,
            tenantId,
            role: tenantRole,
          },
        });
      }

      return newUser;
    });

    const users = await listUsersForTenant(tenantId);
    const createdSummary = users.find((entry) => entry.id === created.id);

    return NextResponse.json({
      user: createdSummary
        ? {
            ...createdSummary,
            createdAt: createdSummary.createdAt.toISOString(),
            updatedAt: createdSummary.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.warn("Failed to create user", error);
    return NextResponse.json({ error: "Unable to create user" }, { status: 500 });
  }
}
