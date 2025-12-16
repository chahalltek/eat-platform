import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { parseFeatureFlagName, setFeatureFlag } from "@/lib/featureFlags";
import { logFeatureFlagToggle } from "@/lib/audit/adminAudit";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

type RequestBody = {
  flagKey?: unknown;
  enabled?: unknown;
  scope?: unknown;
};

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

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { flagKey, enabled, scope } = body ?? {};
  const parsedName = parseFeatureFlagName(flagKey);

  if (scope && scope !== "tenant") {
    return NextResponse.json({ error: "Only tenant scope is supported" }, { status: 400 });
  }

  if (!parsedName || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "flagKey and enabled are required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const updatedFlag = await setFeatureFlag(parsedName, enabled, tenantId);

  await logFeatureFlagToggle({
    tenantId,
    actorId: user.id,
    flagKey: parsedName,
    enabled,
    scope: "tenant",
  });

  return NextResponse.json({
    flagKey: updatedFlag.name,
    description: updatedFlag.description,
    enabled: updatedFlag.enabled,
    scope: "tenant",
    updatedAt: updatedFlag.updatedAt,
  });
}
