import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { logFeatureFlagToggle } from "@/lib/audit/adminAudit";
import { parseFeatureFlagName, setFeatureFlag } from "@/lib/featureFlags";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

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

  if (!canManageFeatureFlags(user)) {
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

  const { name, enabled } = (body ?? {}) as { name?: unknown; enabled?: unknown };
  const parsedName = parseFeatureFlagName(name);

  if (!parsedName || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "name and enabled are required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const updatedFlag = await setFeatureFlag(parsedName, enabled, tenantId);

  await logFeatureFlagToggle({
    tenantId,
    actorId: user.id,
    flagName: parsedName,
    enabled: updatedFlag.enabled,
  });

  return NextResponse.json(updatedFlag);
}
