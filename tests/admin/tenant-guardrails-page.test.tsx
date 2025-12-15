/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getCurrentTenantId: vi.fn(),
  resolveTenantAdminAccess: vi.fn(),
  getTenantRoleFromHeaders: vi.fn(),
  headers: vi.fn(),
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
  headers: mocks.headers,
}));

vi.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: () => "/admin/tenant/demo/guardrails",
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: mocks.getCurrentTenantId,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mocks.resolveTenantAdminAccess,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: mocks.getTenantRoleFromHeaders,
}));

vi.mock("@/app/admin/tenant/[tenantId]/TenantAdminShell", () => ({
  TenantAdminShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tenant-admin-shell">{children}</div>
  ),
}));

vi.mock("@/app/admin/tenant/[tenantId]/guardrails/GuardrailsPreviewPanel", () => ({
  GuardrailsPreviewPanel: ({ tenantId }: { tenantId: string }) => (
    <div data-testid="guardrails-preview-panel">Guardrails preview for {tenantId}</div>
  ),
}));

vi.mock("@/app/admin/tenant/[tenantId]/guardrails/OptimizationSuggestionsPanel", () => ({
  OptimizationSuggestionsPanel: ({ tenantId }: { tenantId: string }) => (
    <div data-testid="guardrails-optimizations">Optimization suggestions for {tenantId}</div>
  ),
}));

vi.mock("@/components/ETEClientLayout", () => ({
  ETEClientLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import GuardrailsPage from "@/app/admin/tenant/[tenantId]/guardrails/page";

describe("tenant guardrails admin page access", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.getTenantRoleFromHeaders.mockReturnValue(null);
    mocks.getCurrentTenantId.mockResolvedValue("demo");
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "demo" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({
      hasAccess: true,
      isGlobalAdmin: true,
      membership: null,
    });
  });

  it("allows platform admins to reach guardrails presets", async () => {
    const page = await GuardrailsPage({ params: { tenantId: "demo" } });
    render(page);

    const guardrailsHeadings = await screen.findAllByText(/guardrails presets/i);
    expect(guardrailsHeadings.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/admin access required/i)).not.toBeInTheDocument();
    expect(mocks.resolveTenantAdminAccess).toHaveBeenCalledWith(
      { id: "admin-1", role: "ADMIN", tenantId: "demo" },
      "demo",
      { roleHint: null },
    );
  });

  it("captures a stable layout snapshot for the presets page", async () => {
    const page = await GuardrailsPage({ params: { tenantId: "demo" } });
    render(page);

    const layout = screen.getByTestId("guardrails-presets-page");
    expect(layout).toBeInTheDocument();
    expect(layout).toMatchSnapshot();
  });

  it("blocks non-admins with an access warning", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-2", role: "RECRUITER", tenantId: "demo" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });

    const page = await GuardrailsPage({ params: { tenantId: "demo" } });
    render(page);

    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
    expect(mocks.resolveTenantAdminAccess).toHaveBeenCalled();
  });
});
