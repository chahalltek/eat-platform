import { describe, expect, it } from "vitest";

import { DEFAULT_TENANT_ID } from "./config";
import {
  canAccessExecIntelligence,
  canManageFeatureFlags,
  canManagePrompts,
  canManageTenants,
  canViewAgentLogs,
  canViewAuditLogs,
  canViewCandidates,
  canViewEnvironment,
  canViewQualityMetrics,
  canUseStrategicCopilot,
} from "./permissions";
import { USER_ROLES } from "./roles";

const buildUser = (role: string | null, tenantId: string | null = "tenant-a") => ({
  id: "user-1",
  role,
  tenantId,
});

describe("RBAC permission matrix", () => {
  it("grants tenant-scoped candidate access to frontline roles", () => {
    const tenant = "tenant-a";
    const rolesWithAccess = [
      USER_ROLES.RECRUITER,
      USER_ROLES.MANAGER,
      USER_ROLES.SOURCER,
      USER_ROLES.SALES,
      USER_ROLES.ADMIN,
      USER_ROLES.TENANT_ADMIN,
      USER_ROLES.SYSTEM_ADMIN,
    ];

    rolesWithAccess.forEach((role) => {
      expect(canViewCandidates(buildUser(role, tenant), tenant)).toBe(true);
    });
  });

  it("denies candidate access across tenants except for system admins", () => {
    const tenantA = "tenant-a";
    const tenantB = "tenant-b";

    expect(canViewCandidates(buildUser(USER_ROLES.ADMIN, tenantA), tenantB)).toBe(false);
    expect(canViewCandidates(buildUser(USER_ROLES.TENANT_ADMIN, tenantA), tenantB)).toBe(false);
    expect(canViewCandidates(buildUser(USER_ROLES.MANAGER, tenantA), tenantB)).toBe(false);
    expect(canViewCandidates(buildUser(USER_ROLES.RECRUITER, tenantA), tenantB)).toBe(false);
    expect(canViewCandidates(buildUser(USER_ROLES.SOURCER, tenantA), tenantB)).toBe(false);
    expect(canViewCandidates(buildUser(USER_ROLES.SALES, tenantA), tenantB)).toBe(false);
    expect(canViewCandidates(buildUser(USER_ROLES.SYSTEM_ADMIN, tenantA), tenantB)).toBe(true);
  });

  it("limits prompt management to admins within the same tenant", () => {
    const tenant = "tenant-a";

    expect(canManagePrompts(buildUser(USER_ROLES.ADMIN, tenant), tenant)).toBe(true);
    expect(canManagePrompts(buildUser(USER_ROLES.TENANT_ADMIN, tenant), tenant)).toBe(true);
    expect(canManagePrompts(buildUser(USER_ROLES.MANAGER, tenant), tenant)).toBe(false);
    expect(canManagePrompts(buildUser(USER_ROLES.RECRUITER, tenant), tenant)).toBe(false);
    expect(canManagePrompts(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), tenant)).toBe(true);
    expect(canManagePrompts(buildUser(USER_ROLES.ADMIN, tenant), "tenant-b")).toBe(false);
    expect(canManagePrompts(buildUser(USER_ROLES.TENANT_ADMIN, tenant), "tenant-b")).toBe(false);
    expect(canManagePrompts(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), "tenant-b")).toBe(true);
  });

  it("allows audit log visibility for managers and admins within their tenant", () => {
    const tenant = "tenant-a";

    expect(canViewAuditLogs(buildUser(USER_ROLES.MANAGER, tenant), tenant)).toBe(true);
    expect(canViewAuditLogs(buildUser(USER_ROLES.ADMIN, tenant), tenant)).toBe(true);
    expect(canViewAuditLogs(buildUser(USER_ROLES.TENANT_ADMIN, tenant), tenant)).toBe(true);
    expect(canViewAuditLogs(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), tenant)).toBe(true);
    expect(canViewAuditLogs(buildUser(USER_ROLES.RECRUITER, tenant), tenant)).toBe(false);
    expect(canViewAuditLogs(buildUser(USER_ROLES.MANAGER, tenant), "tenant-b")).toBe(false);
    expect(canViewAuditLogs(buildUser(USER_ROLES.TENANT_ADMIN, tenant), "tenant-b")).toBe(false);
    expect(canViewAuditLogs(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), "tenant-b")).toBe(true);
  });

  it("restricts feature flag and environment views to admins", () => {
    expect(canManageFeatureFlags(buildUser(USER_ROLES.ADMIN, "tenant-a"))).toBe(true);
    expect(canManageFeatureFlags(buildUser(USER_ROLES.TENANT_ADMIN, "tenant-a"))).toBe(true);
    expect(canManageFeatureFlags(buildUser(USER_ROLES.SYSTEM_ADMIN, "tenant-a"))).toBe(true);
    expect(canManageFeatureFlags(buildUser(USER_ROLES.MANAGER, "tenant-a"))).toBe(false);

    expect(canViewEnvironment(buildUser(USER_ROLES.ADMIN, "tenant-a"))).toBe(true);
    expect(canViewEnvironment(buildUser(USER_ROLES.TENANT_ADMIN, "tenant-a"))).toBe(true);
    expect(canViewEnvironment(buildUser(USER_ROLES.SYSTEM_ADMIN, "tenant-a"))).toBe(true);
    expect(canViewEnvironment(buildUser(USER_ROLES.RECRUITER, "tenant-a"))).toBe(false);
  });

  it("allows only admins to view quality metrics", () => {
    expect(canViewQualityMetrics(buildUser(USER_ROLES.ADMIN, "tenant-a"))).toBe(true);
    expect(canViewQualityMetrics(buildUser(USER_ROLES.TENANT_ADMIN, "tenant-a"))).toBe(true);
    expect(canViewQualityMetrics(buildUser(USER_ROLES.SYSTEM_ADMIN, "tenant-a"))).toBe(true);
    expect(canViewQualityMetrics(buildUser(USER_ROLES.MANAGER, "tenant-a"))).toBe(false);
  });

  it("allows only admins and system admins to view agent run logs", () => {
    const tenant = "tenant-a";

    expect(canViewAgentLogs(buildUser(USER_ROLES.ADMIN, tenant), tenant)).toBe(true);
    expect(canViewAgentLogs(buildUser(USER_ROLES.TENANT_ADMIN, tenant), tenant)).toBe(true);
    expect(canViewAgentLogs(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), tenant)).toBe(true);
    expect(canViewAgentLogs(buildUser(USER_ROLES.MANAGER, tenant), tenant)).toBe(false);
    expect(canViewAgentLogs(buildUser(USER_ROLES.ADMIN, tenant), "tenant-b")).toBe(false);
    expect(canViewAgentLogs(buildUser(USER_ROLES.TENANT_ADMIN, tenant), "tenant-b")).toBe(false);
    expect(canViewAgentLogs(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), "tenant-b")).toBe(true);
  });

  it("allows admins and system admins to manage tenants", () => {
    expect(canManageTenants(buildUser(USER_ROLES.SYSTEM_ADMIN, "tenant-a"))).toBe(true);
    expect(canManageTenants(buildUser(USER_ROLES.ADMIN, "tenant-a"))).toBe(true);
    expect(canManageTenants(buildUser(USER_ROLES.TENANT_ADMIN, "tenant-a"))).toBe(true);
  });

  it("falls back to the default tenant when none is provided", () => {
    const defaultTenantUser = buildUser(USER_ROLES.ADMIN, null);

    expect(canViewCandidates(defaultTenantUser, null)).toBe(true);
    expect(canViewAuditLogs(defaultTenantUser, undefined)).toBe(true);
    expect(canViewAgentLogs(buildUser(USER_ROLES.ADMIN, null), undefined)).toBe(true);

    const crossTenantDefaultUser = buildUser(USER_ROLES.ADMIN, "tenant-b");
    expect(canViewCandidates(crossTenantDefaultUser, DEFAULT_TENANT_ID)).toBe(false);
  });

  it("denies everything for unknown roles", () => {
    const invalidUser = buildUser("unknown", "tenant-a");

    expect(canViewCandidates(invalidUser, "tenant-a")).toBe(false);
    expect(canManagePrompts(invalidUser, "tenant-a")).toBe(false);
    expect(canViewAuditLogs(invalidUser, "tenant-a")).toBe(false);
    expect(canManageFeatureFlags(invalidUser)).toBe(false);
    expect(canViewEnvironment(invalidUser)).toBe(false);
    expect(canViewQualityMetrics(invalidUser)).toBe(false);
    expect(canManageTenants(invalidUser)).toBe(false);
  });

  it("limits exec intelligence to execs and admins within their tenant", () => {
    const tenant = "tenant-a";

    expect(canAccessExecIntelligence(buildUser(USER_ROLES.EXEC, tenant), tenant)).toBe(true);
    expect(canAccessExecIntelligence(buildUser(USER_ROLES.ADMIN, tenant), tenant)).toBe(true);
    expect(canAccessExecIntelligence(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), tenant)).toBe(true);

    expect(canAccessExecIntelligence(buildUser(USER_ROLES.RECRUITER, tenant), tenant)).toBe(false);
    expect(canAccessExecIntelligence(buildUser(USER_ROLES.MANAGER, tenant), tenant)).toBe(false);

    expect(canAccessExecIntelligence(buildUser(USER_ROLES.EXEC, tenant), "tenant-b")).toBe(false);
    expect(canAccessExecIntelligence(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), "tenant-b")).toBe(true);
  });

  it("restricts strategic copilot usage to exec and admin roles with tenant alignment", () => {
    const tenant = "tenant-a";

    expect(canUseStrategicCopilot(buildUser(USER_ROLES.EXEC, tenant), tenant)).toBe(true);
    expect(canUseStrategicCopilot(buildUser(USER_ROLES.ADMIN, tenant), tenant)).toBe(true);
    expect(canUseStrategicCopilot(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), tenant)).toBe(true);

    expect(canUseStrategicCopilot(buildUser(USER_ROLES.RECRUITER, tenant), tenant)).toBe(false);
    expect(canUseStrategicCopilot(buildUser(USER_ROLES.MANAGER, tenant), tenant)).toBe(false);

    expect(canUseStrategicCopilot(buildUser(USER_ROLES.EXEC, tenant), "tenant-b")).toBe(false);
    expect(canUseStrategicCopilot(buildUser(USER_ROLES.SYSTEM_ADMIN, tenant), "tenant-b")).toBe(true);
  });
});
