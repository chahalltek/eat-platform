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
  headers: mocks.headers,
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

    expect(await screen.findByText(/guardrails presets/i)).toBeInTheDocument();
    expect(screen.queryByText(/admin access required/i)).not.toBeInTheDocument();
    expect(mocks.resolveTenantAdminAccess).toHaveBeenCalledWith(
      { id: "admin-1", role: "ADMIN", tenantId: "demo" },
      "demo",
      { roleHint: null },
    );
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
