export const USER_ROLES = {
  ADMIN: 'ADMIN',
  RECRUITER: 'RECRUITER',
  SOURCER: 'SOURCER',
  SALES: 'SALES',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function normalizeRole(role: string | null | undefined): UserRole | null {
  const normalized = (role ?? '').trim().toUpperCase();
  return (Object.values(USER_ROLES) as string[]).includes(normalized) ? (normalized as UserRole) : null;
}

export function isAdminRole(role: string | null | undefined) {
  return normalizeRole(role) === USER_ROLES.ADMIN;
}
