import { DEFAULT_TENANT_ID } from "./config";
import { normalizeRole, USER_ROLES, type UserRole } from "./roles";
import type { IdentityUser } from "./types";

type PermissionUser = Pick<IdentityUser, "role" | "tenantId" | "id"> | null;

type Permission =
  | "VIEW_CANDIDATES"
  | "MANAGE_PROMPTS"
  | "VIEW_AUDIT_LOGS"
  | "MANAGE_FEATURE_FLAGS"
  | "VIEW_ENVIRONMENT"
  | "VIEW_QUALITY_METRICS"
  | "VIEW_AGENT_LOGS"
  | "MANAGE_TENANTS"
  | "VIEW_EXEC_INTELLIGENCE"
  | "USE_STRATEGIC_COPILOT";

const ROLE_PERMISSION_MAP: Record<UserRole, Set<Permission>> = {
  [USER_ROLES.ADMIN]: new Set([
    "VIEW_CANDIDATES",
    "MANAGE_PROMPTS",
    "VIEW_AUDIT_LOGS",
    "MANAGE_FEATURE_FLAGS",
    "VIEW_ENVIRONMENT",
    "VIEW_QUALITY_METRICS",
    "VIEW_AGENT_LOGS",
    "MANAGE_TENANTS",
    "VIEW_EXEC_INTELLIGENCE",
    "USE_STRATEGIC_COPILOT",
  ]),
  [USER_ROLES.TENANT_ADMIN]: new Set([
    "VIEW_CANDIDATES",
    "MANAGE_PROMPTS",
    "VIEW_AUDIT_LOGS",
    "MANAGE_FEATURE_FLAGS",
    "VIEW_ENVIRONMENT",
    "VIEW_QUALITY_METRICS",
    "VIEW_AGENT_LOGS",
    "MANAGE_TENANTS",
    "VIEW_EXEC_INTELLIGENCE",
    "USE_STRATEGIC_COPILOT",
  ]),
  [USER_ROLES.DATA_ACCESS]: new Set([
    "VIEW_CANDIDATES",
    "VIEW_AUDIT_LOGS",
    "VIEW_ENVIRONMENT",
    "VIEW_QUALITY_METRICS",
    "VIEW_AGENT_LOGS",
    "VIEW_EXEC_INTELLIGENCE",
  ]),
  [USER_ROLES.MANAGER]: new Set(["VIEW_CANDIDATES", "VIEW_AUDIT_LOGS"]),
  [USER_ROLES.RECRUITER]: new Set(["VIEW_CANDIDATES"]),
  [USER_ROLES.SOURCER]: new Set(["VIEW_CANDIDATES"]),
  [USER_ROLES.SALES]: new Set(["VIEW_CANDIDATES"]),
  [USER_ROLES.SYSTEM_ADMIN]: new Set<Permission>([
    "VIEW_CANDIDATES",
    "MANAGE_PROMPTS",
    "VIEW_AUDIT_LOGS",
    "MANAGE_FEATURE_FLAGS",
    "VIEW_ENVIRONMENT",
    "VIEW_QUALITY_METRICS",
    "VIEW_AGENT_LOGS",
    "MANAGE_TENANTS",
    "VIEW_EXEC_INTELLIGENCE",
    "USE_STRATEGIC_COPILOT",
  ]),
  [USER_ROLES.EXEC]: new Set<Permission>(["VIEW_EXEC_INTELLIGENCE", "USE_STRATEGIC_COPILOT"]),
};

function getUserRole(user: PermissionUser) {
  return normalizeRole(user?.role);
}

function hasPermission(user: PermissionUser, permission: Permission) {
  const role = getUserRole(user);

  if (!role) {
    return false;
  }

  return ROLE_PERMISSION_MAP[role]?.has(permission) ?? false;
}

function hasTenantAccess(user: PermissionUser, tenantId?: string | null) {
  const role = getUserRole(user);

  if (!role) {
    return false;
  }

  if (role === USER_ROLES.SYSTEM_ADMIN) {
    return true;
  }

  const normalizedTenant = (tenantId ?? DEFAULT_TENANT_ID).trim();
  const userTenant = (user?.tenantId ?? DEFAULT_TENANT_ID).trim();

  return normalizedTenant === userTenant;
}

export function canViewCandidates(user: PermissionUser, tenantId?: string | null) {
  return hasPermission(user, "VIEW_CANDIDATES") && hasTenantAccess(user, tenantId);
}

export function canManagePrompts(user: PermissionUser, tenantId?: string | null) {
  if (!hasPermission(user, "MANAGE_PROMPTS")) {
    return false;
  }

  return hasTenantAccess(user, tenantId);
}

export function canViewAuditLogs(user: PermissionUser, tenantId?: string | null) {
  if (!hasPermission(user, "VIEW_AUDIT_LOGS")) {
    return false;
  }

  return hasTenantAccess(user, tenantId);
}

export function canManageFeatureFlags(user: PermissionUser) {
  return hasPermission(user, "MANAGE_FEATURE_FLAGS");
}

export function canViewEnvironment(user: PermissionUser) {
  return hasPermission(user, "VIEW_ENVIRONMENT");
}

export function canViewQualityMetrics(user: PermissionUser) {
  return hasPermission(user, "VIEW_QUALITY_METRICS");
}

export function canViewAgentLogs(user: PermissionUser, tenantId?: string | null) {
  if (!hasPermission(user, "VIEW_AGENT_LOGS")) {
    return false;
  }

  return hasTenantAccess(user, tenantId);
}

export function canManageTenants(user: PermissionUser) {
  return hasPermission(user, "MANAGE_TENANTS");
}

export function canAccessExecIntelligence(user: PermissionUser, tenantId?: string | null) {
  return hasPermission(user, "VIEW_EXEC_INTELLIGENCE") && hasTenantAccess(user, tenantId);
}

export function canUseStrategicCopilot(user: PermissionUser, tenantId?: string | null) {
  return hasPermission(user, "USE_STRATEGIC_COPILOT") && hasTenantAccess(user, tenantId);
}
