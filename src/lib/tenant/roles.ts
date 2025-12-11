export const TENANT_ROLES = {
  Admin: "Admin",
  Recruiter: "Recruiter",
} as const;

export type TenantRole = (typeof TENANT_ROLES)[keyof typeof TENANT_ROLES];

export function normalizeTenantRole(role: string | null | undefined): TenantRole | null {
  const normalized = (role ?? "").trim().toUpperCase();

  if (normalized === "ADMIN" || normalized === "TENANT_ADMIN") {
    return TENANT_ROLES.Admin;
  }

  if (normalized === "RECRUITER") {
    return TENANT_ROLES.Recruiter;
  }

  return null;
}

export function isTenantAdminRole(role: string | null | undefined) {
  return normalizeTenantRole(role) === TENANT_ROLES.Admin;
}

export function getTenantRoleFromHeaders(headers: Headers) {
  const raw = headers.get("x-eat-user-role");
  return normalizeTenantRole(raw);
}
