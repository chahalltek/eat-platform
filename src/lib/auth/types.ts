import type { NextRequest } from "next/server";

import type { UserRole } from "./roles";

export type IdentityUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string | null;
  permissions?: string[] | null;
  tenantId?: string | null;
};

export type IdentityClaims = {
  userId: string | null;
  tenantId: string | null;
  roles: UserRole[];
  permissions: string[];
  email?: string | null;
  displayName?: string | null;
};

export interface IdentityProvider {
  getCurrentUser(req?: NextRequest): Promise<IdentityUser | null>;
  getUserClaims(req?: NextRequest): Promise<IdentityClaims>;
  getUserTenantId(req?: NextRequest): Promise<string | null>;
  getUserRoles(req?: NextRequest): Promise<UserRole[]>;
}
