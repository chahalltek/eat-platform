/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTenantRoleFromHeaders: vi.fn(),
  resolveTenantAdminAccess: vi.fn(),
  getTenantTestRunnerCatalog: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/components/ETEClientLayout", () => ({
  ETEClientLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ete-layout">{children}</div>
  ),
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

vi.mock("@/lib/testing/testCatalog", () => ({
  getTenantTestRunnerCatalog: mocks.getTenantTestRunnerCatalog,
}));

import EteTestRunnerPage from "@/app/admin/tenant/[tenantId]/test-runner/ete/page";

describe("Tenant ETE test runner page", () => {
  it("renders the catalog when access is granted", async () => {
    const catalog = [
      { id: "catalog-registry", title: "ETE catalog registry", description: "Exports curated catalog", tags: ["ete", "ops"], localCommand: "npm run ete:catalog" },
      { id: "mvp-smoke", title: "MVP smoke checklist", description: "High-signal smoke path", tags: ["smoke", "mvp"], localCommand: "npm run verify:mvp:smoke" },
    ];

    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "acme" });
    mocks.getTenantRoleFromHeaders.mockResolvedValue("ADMIN");
    mocks.resolveTenantAdminAccess.mockResolvedValue({ hasAccess: true });
    mocks.getTenantTestRunnerCatalog.mockReturnValue(catalog);

    const page = await EteTestRunnerPage({ params: { tenantId: "acme" } });
    render(page);

    expect(await screen.findByTestId("ete-layout")).toBeInTheDocument();

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(catalog.length);
    expect(cards[0]).toHaveTextContent("ETE catalog registry");
  });
});
