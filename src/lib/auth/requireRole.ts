import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { IdentityUser } from "./types";
import { getCurrentUser } from "./user";
import { normalizeRole, USER_ROLES, type UserRole } from "./roles";

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

const ADMIN_ROLES = [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN, USER_ROLES.TENANT_ADMIN];
const ADMIN_OR_DATA_ACCESS_ROLES: UserRole[] = [
  ...ADMIN_ROLES,
  USER_ROLES.DATA_ACCESS,
];
const RECRUITER_OR_ADMIN_ROLES: UserRole[] = [
  ...ADMIN_ROLES,
  USER_ROLES.RECRUITER,
  USER_ROLES.SOURCER,
  USER_ROLES.SALES,
];
const HIRING_MANAGER_OR_ADMIN_ROLES: UserRole[] = [...ADMIN_ROLES, USER_ROLES.MANAGER];

export function requireRecruiterOrAdmin(req: NextRequest) {
  return requireRole(req, RECRUITER_OR_ADMIN_ROLES);
}

export function requireHiringManagerOrAdmin(req: NextRequest) {
  return requireRole(req, HIRING_MANAGER_OR_ADMIN_ROLES);
}

export function requireAdminOrDataAccess(req: NextRequest) {
  return requireRole(req, ADMIN_OR_DATA_ACCESS_ROLES);
}
