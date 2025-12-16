/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resolveTenantAdminAccess: vi.fn(),
  listAgentKillSwitches: vi.fn(),
  loadTenantMode: vi.fn(),
  buildTenantDiagnostics: vi.fn(),
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
  usePathname: () => "/admin/tenant/demo/operations-runbook",
}));

vi.mock("@/components/EteLogo", () => ({
  EteLogo: () => <div data-testid="ete-logo" />,
}));

vi.mock("@/components/ETEClientLayout", () => ({
  ETEClientLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/auth/tenantAdmin", () => ({
  requireTenantAdmin: vi.fn(),
}));

vi.mock("@/lib/agents/killSwitch", () => ({
  listAgentKillSwitches: mocks.listAgentKillSwitches,
}));

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: mocks.loadTenantMode,
}));

vi.mock("@/lib/tenant/diagnostics", () => ({
  buildTenantDiagnostics: mocks.buildTenantDiagnostics,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mocks.resolveTenantAdminAccess,
}));

import OperationsRunbookPage from "@/app/admin/tenant/[tenantId]/operations-runbook/page";

describe("Operations runbook readiness summary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1" });
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: true });
    mocks.listAgentKillSwitches.mockResolvedValue([]);
    mocks.loadTenantMode.mockResolvedValue({ mode: "production" });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("shows readiness summary with unknown states when diagnostics are unavailable", async () => {
    mocks.buildTenantDiagnostics.mockRejectedValue(new Error("unavailable"));

    const page = await OperationsRunbookPage({ params: { tenantId: "tenant-123" } });
    render(page);

    expect(screen.getByText(/Operational Readiness Summary/i)).toBeInTheDocument();
    const diagnosticsLabel = screen.getByText(/Diagnostics available/i);
    expect(diagnosticsLabel.nextElementSibling?.textContent).toContain("NO");

    const jobIntentLabel = screen.getByText(/Job intent pipeline/i);
    expect(jobIntentLabel.nextElementSibling?.textContent).toContain("UNKNOWN");
  });

  it("allows read-only access for the default tenant when unauthenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.resolveTenantAdminAccess.mockResolvedValue({
      hasAccess: false,
      isGlobalAdmin: false,
      membership: null,
      roleHint: null,
      reason: "No authenticated user",
    });
    mocks.buildTenantDiagnostics.mockResolvedValue({ jobIntent: { status: "ready" } });

    const page = await OperationsRunbookPage({ params: { tenantId: "default-tenant" } });
    render(page);

    expect(screen.getByText(/Operational Readiness Summary/i)).toBeInTheDocument();
    expect(screen.queryByText(/Admin access required/i)).not.toBeInTheDocument();
  });
});
