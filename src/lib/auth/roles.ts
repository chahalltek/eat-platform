export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  RECRUITER: 'RECRUITER',
  SOURCER: 'SOURCER',
  SALES: 'SALES',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function normalizeRole(role: string | null | undefined): UserRole | null {
  const normalized = (role ?? '').trim().toUpperCase();
  return (Object.values(USER_ROLES) as string[]).includes(normalized) ? (normalized as UserRole) : null;
}

export function isAdminRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized === USER_ROLES.ADMIN || normalized === USER_ROLES.SYSTEM_ADMIN;
}
