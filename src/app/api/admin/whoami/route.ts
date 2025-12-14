import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser, getUserRoles } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const requestedTenantId = searchParams.get("tenantId")?.trim() || null;

  const [user, roles, sessionTenantId] = await Promise.all([
    getCurrentUser(request),
    getUserRoles(request),
    getCurrentTenantId(request),
  ]);

  const roleHint = getTenantRoleFromHeaders(request.headers);
  const tenantIdForAccess = requestedTenantId ?? sessionTenantId ?? "";
  const access = await resolveTenantAdminAccess(user, tenantIdForAccess, { roleHint });

  return NextResponse.json({
    user,
    roles,
    tenant: {
      requested: requestedTenantId,
      session: sessionTenantId,
    },
    roleHint,
    access,
    environment: process.env.NODE_ENV,
  });
}
