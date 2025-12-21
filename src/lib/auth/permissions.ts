import { DEFAULT_TENANT_ID } from "./config";
import { isBootstrapTenant } from "../tenant/bootstrap";
import { normalizeRole, USER_ROLES, type UserRole } from "./roles";
import type { IdentityClaims, IdentityUser } from "./types";

type PermissionUser = Pick<IdentityUser, "role" | "tenantId" | "id"> | null;

type Permission =
  | "VIEW_CANDIDATES"
  | "VIEW_FULFILLMENT"
  | "MANAGE_PROMPTS"
  | "VIEW_AUDIT_LOGS"
  | "MANAGE_FEATURE_FLAGS"
  | "VIEW_ENVIRONMENT"
  | "VIEW_QUALITY_METRICS"
  | "VIEW_AGENT_LOGS"
  | "VIEW_FULFILLMENT"
  | "MANAGE_TENANTS"
  | "VIEW_EXEC_INTELLIGENCE"
  | "USE_STRATEGIC_COPILOT"
  | "DECISION_EXPORT"
  | "EXPORT_SHORTLIST"
  | "EXPORT_MATCHES"
  | "fulfillment.view"
  | "agent.run.intake"
  | "agent.run.profile"
  | "agent.run.match"
  | "agent.run.confidence"
  | "agent.run.explain"
  | "agent.run.shortlist"
  | "decision.create"
  | "decision.publish"
  | "decision.export"
  | "admin.rbac.manage";

const FULFILLMENT_SOURCER_PERMISSIONS: Permission[] = [
  "VIEW_CANDIDATES",
  "fulfillment.view",
  "agent.run.intake",
  "agent.run.profile",
  "agent.run.match",
  "agent.run.confidence",
  "agent.run.explain",
  "decision.create",
];

const FULFILLMENT_RECRUITER_PERMISSIONS: Permission[] = [
  ...FULFILLMENT_SOURCER_PERMISSIONS,
  "agent.run.shortlist",
  "decision.publish",
  "decision.export",
];

const FULFILLMENT_MANAGER_PERMISSIONS: Permission[] = [...FULFILLMENT_RECRUITER_PERMISSIONS];

const ADMIN_PERMISSIONS: Permission[] = [
  ...FULFILLMENT_MANAGER_PERMISSIONS,
  "VIEW_AUDIT_LOGS",
  "MANAGE_PROMPTS",
  "MANAGE_FEATURE_FLAGS",
  "VIEW_ENVIRONMENT",
  "VIEW_QUALITY_METRICS",
  "VIEW_AGENT_LOGS",
  "MANAGE_TENANTS",
  "VIEW_EXEC_INTELLIGENCE",
  "USE_STRATEGIC_COPILOT",
  "EXPORT_SHORTLIST",
  "EXPORT_MATCHES",
  "admin.rbac.manage",
];

const ROLE_PERMISSION_MAP: Record<UserRole, Set<Permission>> = {
  [USER_ROLES.ADMIN]: new Set(ADMIN_PERMISSIONS),
  [USER_ROLES.TENANT_ADMIN]: new Set(ADMIN_PERMISSIONS),

  [USER_ROLES.DATA_ACCESS]: new Set([
    "VIEW_CANDIDATES",
    "VIEW_FULFILLMENT",
    "VIEW_AUDIT_LOGS",
    "VIEW_ENVIRONMENT",
    "VIEW_QUALITY_METRICS",
    "VIEW_AGENT_LOGS",
    "VIEW_FULFILLMENT",
    "VIEW_EXEC_INTELLIGENCE",
    "DECISION_EXPORT",
    "EXPORT_SHORTLIST",
    "EXPORT_MATCHES",
    "fulfillment.view",
  ]),
  [USER_ROLES.MANAGER]: new Set(["VIEW_CANDIDATES", "VIEW_AUDIT_LOGS", "fulfillment.view"]),
  [USER_ROLES.RECRUITER]: new Set([...FULFILLMENT_RECRUITER_PERMISSIONS]),
  [USER_ROLES.SOURCER]: new Set([...FULFILLMENT_SOURCER_PERMISSIONS]),
  [USER_ROLES.FULFILLMENT_SOURCER]: new Set([...FULFILLMENT_SOURCER_PERMISSIONS]),
  [USER_ROLES.FULFILLMENT_RECRUITER]: new Set([...FULFILLMENT_RECRUITER_PERMISSIONS]),
  [USER_ROLES.FULFILLMENT_MANAGER]: new Set([...FULFILLMENT_MANAGER_PERMISSIONS]),
  [USER_ROLES.SALES]: new Set(["VIEW_CANDIDATES", "fulfillment.view"]),
  [USER_ROLES.SYSTEM_ADMIN]: new Set<Permission>(ADMIN_PERMISSIONS),
  [USER_ROLES.EXEC]: new Set<Permission>(["VIEW_EXEC_INTELLIGENCE", "USE_STRATEGIC_COPILOT"]),
};

export type NamedPermission = "fulfillment.view" | "admin.rbac.manage" | "agent.run.match";

const ROLE_NAMED_PERMISSION_MAP: Record<UserRole, Set<NamedPermission>> = {
  [USER_ROLES.ADMIN]: new Set(["fulfillment.view", "admin.rbac.manage", "agent.run.match"]),
  [USER_ROLES.TENANT_ADMIN]: new Set(["fulfillment.view", "admin.rbac.manage", "agent.run.match"]),
  [USER_ROLES.SYSTEM_ADMIN]: new Set(["fulfillment.view", "admin.rbac.manage", "agent.run.match"]),
  [USER_ROLES.DATA_ACCESS]: new Set(["fulfillment.view"]),
  [USER_ROLES.RECRUITER]: new Set(["fulfillment.view", "agent.run.match"]),
  [USER_ROLES.SOURCER]: new Set(["fulfillment.view"]),
  [USER_ROLES.SALES]: new Set(["fulfillment.view"]),
  [USER_ROLES.MANAGER]: new Set(["fulfillment.view"]),
  [USER_ROLES.EXEC]: new Set(),
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

  if (role === USER_ROLES.ADMIN && isBootstrapTenant(tenantId ?? DEFAULT_TENANT_ID)) {
    return true;
  }

  const normalizedTenant = (tenantId ?? DEFAULT_TENANT_ID).trim();
  const userTenant = (user?.tenantId ?? DEFAULT_TENANT_ID).trim();

  return normalizedTenant === userTenant;
}

function hasFulfillmentPermission(user: PermissionUser, permission: Permission, tenantId?: string | null) {
  if (!hasPermission(user, permission)) {
    return false;
  }

  return hasTenantAccess(user, tenantId);
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

export function canViewFulfillment(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "fulfillment.view", tenantId);
}

export function canAccessExecIntelligence(user: PermissionUser, tenantId?: string | null) {
  return hasPermission(user, "VIEW_EXEC_INTELLIGENCE") && hasTenantAccess(user, tenantId);
}

export function canUseStrategicCopilot(user: PermissionUser, tenantId?: string | null) {
  return hasPermission(user, "USE_STRATEGIC_COPILOT") && hasTenantAccess(user, tenantId);
}

export function canExportDecisionDrafts(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "decision.export", tenantId);
}

export function canExportShortlist(user: PermissionUser, tenantId?: string | null) {
  return hasPermission(user, "EXPORT_SHORTLIST") && hasTenantAccess(user, tenantId);
}

export function canExportMatches(user: PermissionUser, tenantId?: string | null) {
  return hasPermission(user, "EXPORT_MATCHES") && hasTenantAccess(user, tenantId);
}

export function canViewFulfillmentNav(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "fulfillment.view", tenantId);
}

export function canCreateDecisionArtifact(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "decision.create", tenantId);
}

export function canPublishDecisionArtifact(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "decision.publish", tenantId);
}

export function canRunAgentIntake(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "agent.run.intake", tenantId);
}

export function canRunAgentProfile(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "agent.run.profile", tenantId);
}

export function canRunAgentMatch(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "agent.run.match", tenantId);
}

export function canRunAgentConfidence(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "agent.run.confidence", tenantId);
}

export function canRunAgentExplain(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "agent.run.explain", tenantId);
}

export function canRunAgentShortlist(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "agent.run.shortlist", tenantId);
}

export function canCreateDecision(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "decision.create", tenantId);
}

export function canCreateDecisionDraft(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "decision.create", tenantId);
}

export function canPublishDecision(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "decision.publish", tenantId);
}

export function canExportDecisions(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "decision.export", tenantId);
}

export function canManageDecisions(user: PermissionUser, tenantId?: string | null) {
  return canCreateDecision(user, tenantId) || canPublishDecision(user, tenantId);
}

export function canManageRbac(user: PermissionUser, tenantId?: string | null) {
  return hasFulfillmentPermission(user, "admin.rbac.manage", tenantId);
}

type PermissionCheckSubject = Pick<IdentityUser, "role" | "permissions"> | IdentityClaims | null;

function normalizePermissionName(permission: string | null | undefined) {
  const normalized = permission?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function can(user: PermissionCheckSubject, permission: NamedPermission | string) {
  const normalizedPermission = normalizePermissionName(permission);
  if (!normalizedPermission) return false;

  const directPermissions = (user?.permissions ?? []).filter(Boolean).map((entry) => entry.trim().toLowerCase());
  if (directPermissions.includes(normalizedPermission)) {
    return true;
  }

  const role = normalizeRole(
    (user as PermissionUser)?.role ?? (Array.isArray((user as IdentityClaims)?.roles) ? (user as IdentityClaims)?.roles[0] : null),
  );
  if (!role) {
    return false;
  }

  return ROLE_NAMED_PERMISSION_MAP[role]?.has(normalizedPermission as NamedPermission) ?? false;
}
