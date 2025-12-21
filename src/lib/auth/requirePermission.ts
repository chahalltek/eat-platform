import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { IdentityUser } from "./types";
import { getCurrentUser, getUserClaims } from "./identityProvider";
import { can } from "./permissions";

type PermissionCheckFailure = { ok: false; response: NextResponse };
type PermissionCheckSuccess = { ok: true; user: IdentityUser };

export async function requirePermission(
  req: NextRequest,
  permission: string,
): Promise<PermissionCheckFailure | PermissionCheckSuccess> {
  const claims = await getUserClaims(req);

  if (!claims.userId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!can(claims, permission)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const user = (await getCurrentUser(req)) ?? {
    id: claims.userId,
    role: claims.roles[0] ?? null,
    permissions: claims.permissions,
    email: claims.email ?? null,
    displayName: claims.displayName ?? claims.email ?? null,
    tenantId: claims.tenantId,
  };

  return { ok: true, user };
}
