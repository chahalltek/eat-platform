import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { normalizeTenantRole, TENANT_ROLES, getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { prisma } from "@/server/db";

function describeDenialReason(options: {
  userId: string | null;
  tenantId: string;
  membershipRole: string | null;
  isPlatformAdmin: boolean;
}) {
  if (!options.userId) {
    return "No authenticated user";
  }

  if (!options.tenantId) {
    return "Missing tenant id";
  }

  if (options.isPlatformAdmin) {
    return "Platform admins should already have access";
  }

  if (!options.membershipRole) {
    return `No tenant membership found for ${options.tenantId}`;
  }

  const normalizedRole = normalizeTenantRole(options.membershipRole);
  if (normalizedRole !== TENANT_ROLES.Admin) {
    return `Tenant role is ${options.membershipRole} (not Admin)`;
  }

  return "Access denied for an unknown reason";
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const [{ tenantId }, user] = await Promise.all([
    params,
    getCurrentUser(req),
  ]);
  const headerRole = getTenantRoleFromHeaders(req.headers);
  const requestedTenantId = tenantId?.trim?.() || DEFAULT_TENANT_ID;
  const isPlatformAdmin = isAdminRole(user?.role);

  const [requestedAccess, defaultTenantMembership, defaultTenantAccess] = await Promise.all([
    resolveTenantAdminAccess(user, requestedTenantId, { roleHint: headerRole }),
    user
      ? prisma.tenantUser.findUnique({
          where: { userId_tenantId: { tenantId: DEFAULT_TENANT_ID, userId: user.id } },
        })
      : Promise.resolve(null),
    resolveTenantAdminAccess(user, DEFAULT_TENANT_ID, { roleHint: headerRole }),
  ]);

  const denialReason = defaultTenantAccess.hasAccess
    ? null
    : describeDenialReason({
        userId: user?.id ?? null,
        tenantId: DEFAULT_TENANT_ID,
        membershipRole: defaultTenantMembership?.role ?? null,
        isPlatformAdmin,
      });

  const payload = {
    userId: user?.id ?? null,
    isPlatformAdmin,
    requestedTenantId,
    headerTenantRole: headerRole ?? null,
    requestedTenantAccess: requestedAccess,
    defaultTenantMembership,
    defaultTenantAccess,
    denialReasonForDefaultTenant: denialReason,
  } as const;

  console.info("/api/tenant/access-debug", payload);

  return NextResponse.json(payload);
}
