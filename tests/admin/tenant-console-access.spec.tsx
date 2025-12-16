/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resolveTenantAdminAccess: vi.fn(),
  getTenantRoleFromHeaders: vi.fn(),
  getCurrentTenantId: vi.fn(),
  loadTenantConfig: vi.fn(),
  buildTenantDiagnostics: vi.fn(),
  getTenantMembershipsForUser: vi.fn(),
  listAgentKillSwitches: vi.fn(),
  loadTenantMode: vi.fn(),
  redirect: vi.fn(),
  getTenantMode: vi.fn(),
  listFeatureFlags: vi.fn(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/headers", () => ({
  __esModule: true,
  headers: () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: () => "/admin/tenant/default",
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

vi.mock("@/components/ETEClientLayout", () => ({
  ETEClientLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ETECard", () => ({
  ETECard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ete-card" data-class={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/admin/AdminCardTitle", () => ({
  AdminCardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/StatusPill", () => ({
  StatusPill: ({ label }: { label: string }) => <span>{label}</span>,
}));

vi.mock("@/components/EteLogo", () => ({
  EteLogo: () => <div data-testid="ete-logo" />,
}));

vi.mock("@/app/admin/tenant/[tenantId]/TenantAdminShell", () => ({
  TenantAdminShell: ({ children }: { children: React.ReactNode }) => <div data-testid="tenant-admin-shell">{children}</div>,
}));

vi.mock("@/app/admin/tenant/[tenantId]/guardrails/GuardrailsPreviewPanel", () => ({
  GuardrailsPreviewPanel: ({ tenantId }: { tenantId: string }) => <div>Preview {tenantId}</div>,
}));

vi.mock("@/app/admin/tenant/[tenantId]/guardrails/OptimizationSuggestionsPanel", () => ({
  OptimizationSuggestionsPanel: ({ tenantId }: { tenantId: string }) => <div>Suggestions {tenantId}</div>,
}));

vi.mock("@/app/admin/tenant/[tenantId]/ops/runtime-controls/RuntimeControlsDashboard", () => ({
  RuntimeControlsDashboard: ({ tenantId }: { tenantId: string }) => <div>Runtime dashboard {tenantId}</div>,
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: mocks.getCurrentTenantId,
  withTenantContext: async <T,>(tenantId: string, cb: () => Promise<T>) => cb(),
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: mocks.getTenantRoleFromHeaders,
}));

vi.mock("@/lib/guardrails/tenantConfig", () => ({
  loadTenantConfig: mocks.loadTenantConfig,
}));

vi.mock("@/lib/tenant/diagnostics", () => ({
  buildTenantDiagnostics: mocks.buildTenantDiagnostics,
  TenantNotFoundError: class extends Error {},
}));

vi.mock("@/lib/tenant/access", async (original) => {
  const actual = await original();
  return {
    ...actual,
    resolveTenantAdminAccess: mocks.resolveTenantAdminAccess,
    getTenantMembershipsForUser: mocks.getTenantMembershipsForUser,
  };
});

vi.mock("@/lib/agents/killSwitch", () => ({
  listAgentKillSwitches: mocks.listAgentKillSwitches,
}));

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: mocks.loadTenantMode,
}));

vi.mock("@/lib/tenantMode", () => ({
  getTenantMode: mocks.getTenantMode,
}));

vi.mock("@/lib/featureFlags", () => ({
  listFeatureFlags: mocks.listFeatureFlags,
}));

const diagnosticsStub = {
  tenantId: "default",
  mode: "production",
  modeNotice: null,
  fireDrill: { enabled: false, fireDrillImpact: [], suggested: false, reason: null, windowMinutes: 0 },
  sso: { configured: false, issuerUrl: null },
  guardrailsPreset: "balanced",
  guardrailsStatus: "ok",
  guardrailsRecommendation: null,
  configSchema: { status: "ok", missingColumns: [], reason: null },
  schemaDrift: { status: "ok", missingColumns: [], reason: null },
  plan: { id: null, name: null, isTrial: false, trialEndsAt: null, limits: null },
  auditLogging: { enabled: false, eventsRecorded: 0 },
  dataExport: { enabled: false },
  retention: { configured: false, days: null, mode: null },
  rateLimits: [],
  featureFlags: { enabled: false, enabledFlags: [] },
  guardrails: {
    source: "demo",
    matcherMinScore: 0,
    shortlistMinScore: 0,
    shortlistMaxCandidates: 0,
    requireMustHaveSkills: false,
    explainLevel: "none",
    confidencePassingScore: 0,
  },
  llm: {
    provider: "",
    model: "",
    allowedAgents: [],
    status: "ready",
    reason: null,
    maxTokens: null,
    verbosityCap: null,
    fireDrillOverride: false,
  },
  ats: {
    provider: "",
    status: "unknown",
    lastRunAt: null,
    nextAttemptAt: null,
    errorMessage: null,
    retryCount: 0,
    summary: null,
  },
};

const tenantMembership = {
  id: "membership-1",
  userId: "tenant-admin",
  tenantId: "default",
  role: "ADMIN",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("tenant admin console guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "default" });
    mocks.getTenantRoleFromHeaders.mockReturnValue(null);
    mocks.getCurrentTenantId.mockResolvedValue("default");
    mocks.resolveTenantAdminAccess.mockResolvedValue({
      hasAccess: true,
      isGlobalAdmin: true,
      membership: null,
      roleHint: null,
    });
    mocks.loadTenantConfig.mockResolvedValue({ schemaMismatch: false });
    mocks.buildTenantDiagnostics.mockResolvedValue(diagnosticsStub);
    mocks.getTenantMembershipsForUser.mockResolvedValue([tenantMembership]);
    mocks.listAgentKillSwitches.mockResolvedValue([]);
    mocks.loadTenantMode.mockResolvedValue({ mode: "production" });
    mocks.getTenantMode.mockResolvedValue("production");
    mocks.listFeatureFlags.mockResolvedValue([]);
    mocks.redirect.mockReturnValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("allows global admins without tenant membership to reach key tenant routes", async () => {
    const { default: GuardrailsPage } = await import("@/app/admin/tenant/[tenantId]/guardrails/page");
    const { default: DiagnosticsPage } = await import("@/app/admin/tenant/[tenantId]/diagnostics/page");
    const { default: RunbookPage } = await import("@/app/admin/tenant/[tenantId]/operations-runbook/page");
    const { default: OpsTestRunnerPage } = await import("@/app/admin/tenant/[tenantId]/ops/test-runner/page");
    const { default: RuntimeControlsPage } = await import("@/app/admin/tenant/[tenantId]/ops/runtime-controls/page");

    const pages = [
      await GuardrailsPage({ params: { tenantId: "default" } }),
      await DiagnosticsPage({ params: { tenantId: "default" } }),
      await RunbookPage({ params: { tenantId: "default" } }),
      await OpsTestRunnerPage({ params: { tenantId: "default" } }),
      await RuntimeControlsPage({ params: { tenantId: "default" } }),
    ];

    pages.forEach((page) => render(page));

    expect(screen.queryAllByText(/admin access required/i).length).toBe(0);
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/tenant/default/ops/test-runner/ete");
  });

  it("allows tenant admin members to reach the same routes", async () => {
    mocks.resolveTenantAdminAccess.mockResolvedValue({
      hasAccess: true,
      isGlobalAdmin: false,
      membership: tenantMembership,
      roleHint: null,
    });

    const { default: GuardrailsPage } = await import("@/app/admin/tenant/[tenantId]/guardrails/page");
    const { default: DiagnosticsPage } = await import("@/app/admin/tenant/[tenantId]/diagnostics/page");
    const { default: RunbookPage } = await import("@/app/admin/tenant/[tenantId]/operations-runbook/page");
    const { default: OpsTestRunnerPage } = await import("@/app/admin/tenant/[tenantId]/ops/test-runner/page");
    const { default: RuntimeControlsPage } = await import("@/app/admin/tenant/[tenantId]/ops/runtime-controls/page");

    const pages = [
      await GuardrailsPage({ params: { tenantId: "default" } }),
      await DiagnosticsPage({ params: { tenantId: "default" } }),
      await RunbookPage({ params: { tenantId: "default" } }),
      await OpsTestRunnerPage({ params: { tenantId: "default" } }),
      await RuntimeControlsPage({ params: { tenantId: "default" } }),
    ];

    pages.forEach((page) => render(page));

    expect(screen.queryAllByText(/admin access required/i).length).toBe(0);
  });

  it("blocks non-admin users without membership", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-2", role: "USER", tenantId: "default" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({
      hasAccess: false,
      isGlobalAdmin: false,
      membership: null,
      roleHint: null,
    });

    const { default: GuardrailsPage } = await import("@/app/admin/tenant/[tenantId]/guardrails/page");
    const { default: DiagnosticsPage } = await import("@/app/admin/tenant/[tenantId]/diagnostics/page");
    const { default: RunbookPage } = await import("@/app/admin/tenant/[tenantId]/operations-runbook/page");
    const { default: OpsTestRunnerPage } = await import("@/app/admin/tenant/[tenantId]/ops/test-runner/page");
    const { default: RuntimeControlsPage } = await import("@/app/admin/tenant/[tenantId]/ops/runtime-controls/page");

    const guardrailsPage = await GuardrailsPage({ params: { tenantId: "default" } });
    render(guardrailsPage);
    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
    cleanup();

    render(await DiagnosticsPage({ params: { tenantId: "default" } }));
    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
    cleanup();

    render(await RunbookPage({ params: { tenantId: "default" } }));
    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
    cleanup();

    render(await OpsTestRunnerPage({ params: { tenantId: "default" } }));
    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
    cleanup();

    render(await RuntimeControlsPage({ params: { tenantId: "default" } }));
    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
  });
});

