/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import ConfidencePage from "@/app/confidence/page";
import ExecutionsPage from "@/app/executions/page";
import ExplainPage from "@/app/explain/page";
import MatchesPage from "@/app/matches/page";
import ShortlistPage from "@/app/shortlist/page";
import { ErrorStatePanel } from "@/components/states/StatePanels";

const mocks = vi.hoisted(() => ({
  jobReqFindMany: vi.fn(),
  getCurrentTenantId: vi.fn(),
  getCurrentUser: vi.fn(),
  canRunAgentMatch: vi.fn(),
  canRunAgentExplain: vi.fn(),
  canRunAgentConfidence: vi.fn(),
  canRunAgentShortlist: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    jobReq: {
      findMany: (...args: unknown[]) => mocks.jobReqFindMany(...args),
    },
  },
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: () => mocks.getCurrentTenantId(),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: () => mocks.getCurrentUser(),
}));

vi.mock("@/lib/auth/permissions", () => ({
  canRunAgentMatch: (...args: unknown[]) => mocks.canRunAgentMatch(...args),
  canRunAgentExplain: (...args: unknown[]) => mocks.canRunAgentExplain(...args),
  canRunAgentConfidence: (...args: unknown[]) => mocks.canRunAgentConfidence(...args),
  canRunAgentShortlist: (...args: unknown[]) => mocks.canRunAgentShortlist(...args),
}));

vi.mock("@/components/ETEClientLayout", () => ({
  ETEClientLayout: ({ children }: { children: ReactNode }) => <div data-testid="layout">{children}</div>,
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

let clipboardMock: ReturnType<typeof vi.fn>;

const baseJob = {
  id: "job-1",
  title: "Frontend Engineer",
  location: "Remote",
  customer: { name: "Acme Corp" },
};

const jobWithCandidates = {
  ...baseJob,
  matchResults: [
    {
      id: "match-1",
      score: 0.82,
      reasons: { summary: "Great overlap" },
      candidateId: "cand-1",
      candidate: { fullName: "Casey Candidate", currentTitle: "Engineer" },
      candidateSignalBreakdown: { confidence: { score: 0.76, band: "High" } },
    },
  ],
};

describe("agent workflow route shells", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentTenantId.mockResolvedValue("tenant-123");
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.canRunAgentMatch.mockReturnValue(true);
    mocks.canRunAgentExplain.mockReturnValue(true);
    mocks.canRunAgentConfidence.mockReturnValue(true);
    mocks.canRunAgentShortlist.mockReturnValue(true);
    mocks.jobReqFindMany.mockResolvedValue([jobWithCandidates]);

    clipboardMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      writable: true,
      value: { writeText: clipboardMock },
    });
  });

  it("renders matches route shell with empty state when no matches are present", async () => {
    mocks.jobReqFindMany.mockResolvedValue([{ ...baseJob, matchResults: [] }]);

    const page = await MatchesPage({ searchParams: {} });
    render(page);

    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByText(/match results/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Frontend Engineer/i })).toBeInTheDocument();
    expect(screen.getByText(/No matches yet/i)).toBeInTheDocument();
    expect(mocks.jobReqFindMany).toHaveBeenCalled();
  });

  it("renders explain route shell with header and empty state", async () => {
    const page = await ExplainPage({ searchParams: {} });
    render(page);

    expect(screen.getByText(/Explain match rationale/i)).toBeInTheDocument();
    expect(screen.getByText(/Select job \+ candidate/i)).toBeInTheDocument();
    expect(mocks.jobReqFindMany).toHaveBeenCalled();
  });

  it("renders confidence route shell with header and empty state", async () => {
    const page = await ConfidencePage({ searchParams: {} });
    render(page);

    expect(screen.getByText(/Run confidence checks/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Confidence to see uncertainty signals/i)).toBeInTheDocument();
    expect(mocks.jobReqFindMany).toHaveBeenCalled();
  });

  it("renders shortlist route shell with header and empty state", async () => {
    const page = await ShortlistPage({ searchParams: {} });
    render(page);

    expect(screen.getByText(/Export-ready shortlist/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Shortlist\./i)).toBeInTheDocument();
    expect(mocks.jobReqFindMany).toHaveBeenCalled();
  });

  it("surfaces RBAC fallback on matches when access is denied", async () => {
    mocks.canRunAgentMatch.mockReturnValue(false);
    mocks.jobReqFindMany.mockResolvedValue([{ ...baseJob, matchResults: [] }]);

    const page = await MatchesPage({ searchParams: {} });
    render(page);

    expect(screen.getByText(/Access restricted/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Sourcer, Recruiter, or Admin access is required to view match results./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy diagnostics/i })).toBeInTheDocument();
  });

  it("copies diagnostics from error panels", async () => {
    render(
      <ErrorStatePanel
        title="Test error"
        message="Top-level error"
        diagnosticsHref="/"
        errorDetails="Detailed failure"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy diagnostics/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument());
    expect(clipboardMock).toHaveBeenCalledWith("Detailed failure");
  });

  it("redirects /executions to the agents runs page", () => {
    ExecutionsPage();

    expect(mocks.redirect).toHaveBeenCalledWith("/agents/runs");
  });
});
