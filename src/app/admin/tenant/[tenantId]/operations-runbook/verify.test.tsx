// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import OperationsRunbookPage from "./page";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/EteLogo", () => ({
  EteLogo: () => <div data-testid="ete-logo" />,
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/tenantAdmin", () => ({
  requireTenantAdmin: vi.fn(),
}));

vi.mock("@/lib/agents/killSwitch", () => ({
  listAgentKillSwitches: vi.fn(),
}));

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: vi.fn(),
}));

vi.mock("@/lib/tenant/diagnostics", () => ({
  buildTenantDiagnostics: vi.fn(),
}));

describe("verify:mvp | operations runbook readiness summary", () => {
  it("renders the operational readiness summary even when diagnostics are unavailable", async () => {
    const { getCurrentUser } = await import("@/lib/auth/user");
    const { requireTenantAdmin } = await import("@/lib/auth/tenantAdmin");
    const { listAgentKillSwitches } = await import("@/lib/agents/killSwitch");
    const { loadTenantMode } = await import("@/lib/modes/loadTenantMode");
    const { buildTenantDiagnostics } = await import("@/lib/tenant/diagnostics");

    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", role: "ADMIN" });
    vi.mocked(requireTenantAdmin).mockResolvedValue({ isAdmin: true });
    vi.mocked(listAgentKillSwitches).mockResolvedValue([
      {
        agentName: "ETE-TS.RUA",
        latched: false,
        reason: null,
        latchedAt: null,
        updatedAt: new Date("2024-04-01T00:00:00Z"),
      },
    ]);
    vi.mocked(loadTenantMode).mockResolvedValue({
      mode: "production",
      guardrailsPreset: "Balanced",
      agentsEnabled: ["RUA", "RINA"],
      source: "fallback",
    });
    vi.mocked(buildTenantDiagnostics).mockRejectedValue(new Error("diagnostics unavailable"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const page = await OperationsRunbookPage({ params: { tenantId: "tenant-123" } });

    render(page);

    await waitFor(() => {
      expect(screen.getAllByText(/Operational Readiness Summary/i).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText(/UNKNOWN/i).length).toBeGreaterThanOrEqual(1);

    errorSpy.mockRestore();
  });
});
