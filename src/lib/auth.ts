import type { NextRequest } from "next/server";

import {
  getCurrentUser as resolveCurrentUser,
  type IdentityUser,
} from "./auth/identityProvider";

export type AppUser = IdentityUser;

export function getCurrentUser(req?: NextRequest) {
  return resolveCurrentUser(req);
}
