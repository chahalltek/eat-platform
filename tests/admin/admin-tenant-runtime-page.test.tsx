/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTenantRoleFromHeaders: vi.fn(),
  resolveTenantAdminAccess: vi.fn(),
  withTenantContext: vi.fn(),
  getTenantMode: vi.fn(),
  listFeatureFlags: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/components/ETEClientLayout", () => ({
  ETEClientLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="runtime-layout">{children}</div>,
}));

vi.mock("@/components/ETECard", () => ({
  ETECard: ({ children }: { children: React.ReactNode }) => <div data-testid="runtime-card">{children}</div>,
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: mocks.getTenantRoleFromHeaders,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mocks.resolveTenantAdminAccess,
}));

vi.mock("@/lib/tenant", () => ({
  withTenantContext: (...args: Parameters<typeof mocks.withTenantContext>) => mocks.withTenantContext(...args),
}));

vi.mock("@/lib/tenantMode", () => ({
  getTenantMode: mocks.getTenantMode,
}));

vi.mock("@/lib/featureFlags", () => ({
  listFeatureFlags: mocks.listFeatureFlags,
}));

vi.mock("@/app/admin/tenant/[tenantId]/runtime/RuntimeModePanel", () => ({
  RuntimeModePanel: ({ tenantId }: { tenantId: string }) => <div>Runtime mode for {tenantId}</div>,
}));

vi.mock("@/app/admin/tenant/[tenantId]/runtime/RuntimeFeatureFlagsPanel", () => ({
  RuntimeFeatureFlagsPanel: ({ tenantId }: { tenantId: string }) => <div>Feature flags for {tenantId}</div>,
}));

vi.mock("@/app/admin/tenant/[tenantId]/BootstrapAccessBanner", () => ({
  BootstrapAccessBanner: ({ tenantId }: { tenantId: string }) => (
    <div data-testid="bootstrap-banner">Bootstrap banner for {tenantId}</div>
  ),
}));

import TenantRuntimeControlsPage from "@/app/admin/tenant/[tenantId]/runtime/page";

describe("Tenant runtime controls page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTenantRoleFromHeaders.mockResolvedValue(null);
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "demo" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: true, membership: null });
    mocks.withTenantContext.mockImplementation(async (_tenantId: string, fn: () => Promise<unknown>) => fn());
    mocks.getTenantMode.mockResolvedValue({ mode: "pilot", guardrailsPreset: "balanced" });
    mocks.listFeatureFlags.mockResolvedValue([
      { key: "feature-a", scope: "tenant", enabled: true, updatedAt: new Date() },
    ]);
  });

  it("renders for global admins without tenant membership", async () => {
    const page = await TenantRuntimeControlsPage({ params: { tenantId: "demo" } });
    render(page);

    expect(await screen.findByTestId("runtime-layout")).toBeInTheDocument();
    expect(screen.getByText(/runtime controls/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime mode for demo/i)).toBeInTheDocument();
    expect(screen.getByText(/feature flags for demo/i)).toBeInTheDocument();
  });

  it("shows a warning to non-admins without membership", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-2", role: "USER", tenantId: "demo" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });

    const page = await TenantRuntimeControlsPage({ params: { tenantId: "demo" } });
    render(page);

    expect(screen.getByText(/admin role required/i)).toBeInTheDocument();
    expect(screen.getByText(/only tenant administrators can make changes/i)).toBeInTheDocument();
  });
});

