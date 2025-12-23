import { NextResponse, type NextRequest } from "next/server";

import { canManageRbac } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(
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

  try {
    const updated = await prisma.user.update({
      where: { id: normalizedUserId },
      data: { updatedAt: new Date() },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.warn("Failed to reset user password", error);
    return NextResponse.json({ error: "Unable to reset password" }, { status: 500 });
  }
}
