import { headers } from "next/headers";

import { DEFAULT_TENANT_ID, ROLE_HEADER, USER_HEADER } from "@/lib/auth/config";
import { normalizeRole } from "@/lib/auth/roles";
import type { IdentityUser } from "@/lib/auth/types";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

function buildHeaderUser(headerList: Headers): IdentityUser | null {
  const headerUserId = headerList.get(USER_HEADER)?.trim();

  if (!headerUserId) return null;

  const headerEmail = headerList.get("x-eat-user-email")?.trim() ?? null;
  const headerName = headerList.get("x-eat-user-name")?.trim() ?? headerEmail;
  const headerRoleValue = normalizeRole(headerList.get(ROLE_HEADER)) ?? null;

  return {
    id: headerUserId,
    email: headerEmail,
    displayName: headerName,
    role: headerRoleValue,
    tenantId: headerList.get("x-eat-tenant-id")?.trim() ?? DEFAULT_TENANT_ID,
  } satisfies IdentityUser;
}

export type TenantAdminPageAccessOptions = {
  tenantId?: string;
  allowAnonymousDefaultTenant?: boolean;
  fallbackToCurrentTenant?: boolean;
  allowHeaderUserFallback?: boolean;
};

export async function getTenantAdminPageAccess(options: TenantAdminPageAccessOptions = {}) {
  const tenantIdFromParams = options.tenantId?.trim?.();
  const resolvedTenantId =
    tenantIdFromParams ??
    (options.fallbackToCurrentTenant ?? true ? (await getCurrentTenantId())?.trim?.() : undefined) ??
    "";
  const headerList = await headers();
  const headerRole = getTenantRoleFromHeaders(headerList);
  const sessionUser = await getCurrentUser();
  const user = sessionUser ?? (options.allowHeaderUserFallback ? buildHeaderUser(headerList) : null);

  const access = await resolveTenantAdminAccess(user, resolvedTenantId, { roleHint: headerRole });
  const allowAnonymousDefaultTenant =
    options.allowAnonymousDefaultTenant && resolvedTenantId === DEFAULT_TENANT_ID && !user;
  const isAllowed = allowAnonymousDefaultTenant || access.hasAccess || access.isGlobalAdmin;
  const isGlobalWithoutMembership = access.isGlobalAdmin && !access.membership;
  const bootstrapTenantId = access.isGlobalAdmin && resolvedTenantId === DEFAULT_TENANT_ID ? resolvedTenantId : null;

  return {
    tenantId: resolvedTenantId,
    user,
    access,
    headerRole,
    allowAnonymousDefaultTenant,
    isAllowed,
    isGlobalWithoutMembership,
    bootstrapTenantId,
  };
}
