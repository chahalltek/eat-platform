import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { canManageFeatureFlags } from "./permissions";
import { getCurrentUser } from "./user";
import type { IdentityUser } from "./types";

export function canAccessRuntimeControls(user: IdentityUser | null) {
  return canManageFeatureFlags(user);
}

export async function requireRuntimeControlsAccess(req?: NextRequest) {
  const user = await getCurrentUser(req);

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!canAccessRuntimeControls(user)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, user };
}
