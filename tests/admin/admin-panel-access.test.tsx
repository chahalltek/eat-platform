/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPlatformHealthSnapshot: vi.fn(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/metrics/platformHealth", () => ({
  getPlatformHealthSnapshot: mocks.getPlatformHealthSnapshot,
}));

import AdminHealthPage from "@/app/admin/page";

describe("/admin access gating", () => {
  const snapshot = {
    agents: { totalAgents: 5, activePrompts: 2, busiestAgents: [], latestPromptUpdate: null },
    runs: { last24h: 12, runningNow: 1, averageDurationMs: null, successRate: 98 },
    errors: { last24h: 0, topByAgent: [] },
    users: { total: 10, admins: 3, activeLastWeek: 6, newThisMonth: 2 },
    database: { tables: [{ label: "Tenants", count: 2 }] },
    killSwitches: [
      { name: "matching", label: "Matching", state: { latched: false, reason: "" } },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformHealthSnapshot.mockResolvedValue(snapshot);
  });

  it("renders the admin dashboard for platform admins", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "demo" });

    const page = await AdminHealthPage();
    render(page);

    expect(screen.getByText(/platform health/i)).toBeInTheDocument();
    expect(screen.queryByText(/admin access required/i)).not.toBeInTheDocument();
    expect(mocks.getPlatformHealthSnapshot).toHaveBeenCalled();
  });

  it("shows an access warning for non-admin users", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "recruiter-1", role: "RECRUITER", tenantId: "demo" });

    const page = await AdminHealthPage();
    render(page);

    expect(screen.getByText(/admin access required/i)).toBeInTheDocument();
    expect(mocks.getPlatformHealthSnapshot).not.toHaveBeenCalled();
  });
});
