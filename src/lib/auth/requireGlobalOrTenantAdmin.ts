import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { normalizeRole, USER_ROLES } from "./roles";
import type { IdentityUser } from "./types";
import { getCurrentUser } from "./user";
import { requireTenantAdmin as checkTenantAdmin } from "./tenantAdmin";

type GlobalOrTenantAdminFailure = { ok: false; response: NextResponse };
type GlobalOrTenantAdminSuccess = {
  ok: true;
  user: IdentityUser;
  access: { actorId: string; isGlobalAdmin: boolean; tenantId: string; membershipRole: string | null };
};

export async function requireGlobalOrTenantAdmin(
  req: NextRequest,
  tenantId: string,
): Promise<GlobalOrTenantAdminFailure | GlobalOrTenantAdminSuccess> {
  const user = await getCurrentUser(req);

  if (!user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const normalizedRole = normalizeRole(user.role);
  const isGlobalAdmin = normalizedRole === USER_ROLES.ADMIN || normalizedRole === USER_ROLES.SYSTEM_ADMIN;

  if (isGlobalAdmin) {
    return {
      ok: true,
      user,
      access: { actorId: user.id, isGlobalAdmin: true, tenantId, membershipRole: null },
    };
  }

  const access = await checkTenantAdmin(tenantId, user.id);

  if (!access.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Tenant admin required" }, { status: 403 }) };
  }

  return {
    ok: true,
    user,
    access: { actorId: user.id, isGlobalAdmin: false, tenantId, membershipRole: access.tenantUser?.role ?? null },
  };
}
