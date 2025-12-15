import type { NextRequest } from "next/server";

import { getCurrentUser as resolveCurrentUser } from "./auth/identityProvider";
import type { IdentityUser } from "./auth/types";

export type AppUser = IdentityUser;

export function getCurrentUser(req?: NextRequest) {
  return resolveCurrentUser(req);
}
