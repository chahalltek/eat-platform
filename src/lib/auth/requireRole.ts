import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { IdentityUser } from "./identityProvider";
import { getCurrentUser } from "./user";
import { normalizeRole, type UserRole } from "./roles";

type RoleCheckFailure = { ok: false; response: NextResponse };
type RoleCheckSuccess = { ok: true; user: IdentityUser };

export async function requireRole(
  req: NextRequest,
  allowedRoles: Array<UserRole | string>,
): Promise<RoleCheckFailure | RoleCheckSuccess> {
  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const normalizedRole = normalizeRole(currentUser.role);
  const normalizedAllowed = allowedRoles
    .map((role) => normalizeRole(role))
    .filter(Boolean) as UserRole[];

  if (!normalizedRole || !normalizedAllowed.includes(normalizedRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user: currentUser };
}
