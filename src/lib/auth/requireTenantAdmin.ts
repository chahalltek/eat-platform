import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { IdentityUser } from "./identityProvider";
import { DEFAULT_TENANT_ID } from "./config";
import { isAdminRole } from "./roles";
import { getCurrentUser } from "./user";
import { requireTenantAdmin as checkTenantAdmin } from "./tenantAdmin";
import { ensureDefaultTenantAdminMembership } from "../tenant/bootstrap";

type TenantAdminFailure = { ok: false; response: NextResponse };
type TenantAdminSuccess = { ok: true; user: IdentityUser };

export async function requireTenantAdmin(
  req: NextRequest,
  tenantId: string,
): Promise<TenantAdminFailure | TenantAdminSuccess> {
  const user = await getCurrentUser(req);

  if (!user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (tenantId === DEFAULT_TENANT_ID && isAdminRole(user.role)) {
    await ensureDefaultTenantAdminMembership(user.id);
  }

  const access = await checkTenantAdmin(tenantId, user.id);

  if (!access.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, user };
}
