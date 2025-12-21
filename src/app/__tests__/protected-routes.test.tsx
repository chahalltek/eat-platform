/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPlatformHealthSnapshot: vi.fn(),
  jobReqFindMany: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/BackToConsoleButton", () => ({
  BackToConsoleButton: () => <button data-testid="back-to-console">Back</button>,
}));

vi.mock("@/components/ETEClientLayout", () => ({
  ETEClientLayout: ({ children }: any) => <div data-testid="ete-client-layout">{children}</div>,
}));

vi.mock("@/app/admin/ete/catalog/CatalogPageClient", () => ({
  CatalogPageClient: () => <div data-testid="catalog-client">Catalog content</div>,
}));

vi.mock("@/app/jobs/JobTable", () => ({
  JobTable: ({ jobs }: { jobs: Array<{ title: string }> }) => (
    <div data-testid="jobs-table">Jobs loaded: {jobs.map((job) => job.title).join(", ")}</div>
  ),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/metrics/platformHealth", () => ({
  getPlatformHealthSnapshot: mocks.getPlatformHealthSnapshot,
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    jobReq: {
      findMany: (...args: unknown[]) => mocks.jobReqFindMany(...args),
    },
  },
}));

import AdminHealthPage from "@/app/admin/page";
import CatalogPage from "@/app/admin/ete/catalog/page";
import FulfillmentPage from "@/app/fulfillment/page";
import JobsPage from "@/app/jobs/page";

const adminSnapshot = {
  agents: { totalAgents: 5, activePrompts: 2, busiestAgents: [], latestPromptUpdate: null },
  runs: { last24h: 12, runningNow: 1, averageDurationMs: null, successRate: 98 },
  errors: { last24h: 0, topByAgent: [] },
  users: { total: 10, admins: 3, activeLastWeek: 6, newThisMonth: 2 },
  database: { tables: [{ label: "Tenants", count: 2 }] },
  killSwitches: [{ name: "matching", label: "Matching", state: { latched: false, reason: "" } }],
};

describe("protected route coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", email: "admin@test.demo" });
    mocks.getPlatformHealthSnapshot.mockResolvedValue(adminSnapshot);
    mocks.jobReqFindMany.mockResolvedValue([
      {
        id: "job-1",
        title: "Frontend Engineer",
        location: "Remote",
        sourceType: "Referral",
        sourceTag: "Campaign",
        createdAt: new Date("2024-02-01T00:00:00Z"),
        updatedAt: new Date("2024-02-02T00:00:00Z"),
        matchResults: [],
        customer: { name: "Acme" },
      },
    ]);
    mocks.redirect.mockImplementation((url: string) => url);
  });

  it("renders the admin dashboard when an admin is authenticated", async () => {
    const page = await AdminHealthPage();
    render(page);

    expect(screen.getByTestId("admin-health-page")).toBeInTheDocument();
    expect(screen.getByText(/platform health/i)).toBeInTheDocument();
    expect(mocks.getPlatformHealthSnapshot).toHaveBeenCalled();
  });

  it("renders the admin catalog page shell for authenticated users", async () => {
    const page = await CatalogPage();
    render(page);

    expect(screen.getByTestId("admin-catalog-page")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-client")).toBeInTheDocument();
  });

  it("renders the jobs page with recruiter-visible data", async () => {
    const page = await JobsPage();
    render(page);

    expect(screen.getByTestId("jobs-page")).toBeInTheDocument();
    expect(screen.getByTestId("jobs-table")).toHaveTextContent("Frontend Engineer");
    expect(mocks.jobReqFindMany).toHaveBeenCalled();
  });

  it("redirects fulfillment deep links to the appropriate dashboard target", () => {
    FulfillmentPage({
      searchParams: { jobId: "job-9", from: "email", returnUrl: "/dashboard" },
    });

    expect(mocks.redirect).toHaveBeenCalledWith("/jobs/job-9?from=email&returnUrl=%2Fdashboard");
  });
});
