/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { useState } from "react";

vi.mock("@prisma/client", () => ({
  JobCandidateStatus: {
    POTENTIAL: "POTENTIAL",
    SHORTLISTED: "SHORTLISTED",
    SUBMITTED: "SUBMITTED",
    INTERVIEWING: "INTERVIEWING",
    HIRED: "HIRED",
    REJECTED: "REJECTED",
  },
}));

import { JobCandidateStatus } from "@prisma/client";

import { AgentRunsTable } from "../agents/runs/AgentRunsTable";
import { EnvTable } from "../admin/env/EnvTable";
import { JobMatchesTable, type MatchRow } from "../jobs/[jobId]/matches/JobMatchesTable";
import { RunMatcherButton } from "../jobs/[jobId]/matches/RunMatcherButton";
import { JobTable } from "../jobs/JobTable";
import { JobOpportunitiesTable } from "../candidates/JobOpportunitiesTable";

let refreshCallback: (() => void) | undefined;
let nextMatches: MatchRow[] = [];

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => refreshCallback?.(),
  }),
}));

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
  vi.stubGlobal("fetch", vi.fn());
  refreshCallback = undefined;
  nextMatches = [];
});

function RunMatcherView() {
  const [matches, setMatches] = useState<MatchRow[]>([]);

  refreshCallback = () => setMatches(nextMatches);

  return (
    <div className="space-y-4">
      <RunMatcherButton jobId="job-123" />
      {matches.length === 0 ? (
        <p>No matches yet</p>
      ) : (
        <JobMatchesTable matches={matches} jobTitle="Test job" jobId="job-123" />
      )}
    </div>
  );
}

describe("Refactored table views", () => {
  it("renders agent runs with formatted status and source", () => {
    render(
      <AgentRunsTable
        runs={[
          {
            id: "1",
            agentName: "Parser",
            status: "Success",
            startedAt: new Date("2024-01-01").toISOString(),
            candidateId: "cand-1",
            source: "API",
          },
        ]}
      />,
    );

    const table = screen.getByRole("table");

    expect(within(table).getByRole("cell", { name: /parser/i })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: /success/i })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: /api/i })).toBeInTheDocument();
  });

  it("runs matcher and populates job matches table", async () => {
    const user = userEvent.setup();

    nextMatches = [
      {
        id: "match-1",
        candidateId: "cand-1",
        jobId: "job-123",
        jobTitle: "Frontend Engineer",
        candidateName: "Alex Doe",
        candidateEmail: "alex@example.com",
        currentTitle: "Engineer",
        score: 0.82,
        jobCandidateId: "jc-1",
        jobCandidateStatus: JobCandidateStatus.SHORTLISTED,
        keySkills: ["React", "TypeScript"],
        jobSkills: ["React", "TypeScript"],
        candidateLocation: "Remote",
        confidenceScore: 0.86,
        shortlisted: true,
        shortlistReason: "Strong fit",
        explanation: { topReasons: ["Great overlap"] },
      },
    ];

    let resolveFetch: (value: Response | PromiseLike<Response>) => void = () => {};
    const matcherPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    (fetch as unknown as vi.Mock).mockImplementation(() => matcherPromise);

    render(<RunMatcherView />);

    expect(screen.getByText(/no matches yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /run matcher/i }));

    expect(screen.getByRole("button", { name: /running matcher/i })).toBeDisabled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/agents/match",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobReqId: "job-123" }),
      }),
    );

    resolveFetch(new Response(JSON.stringify({ agentRunId: "run-123" }), { status: 200 }));

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    const matchRow = rows.find((row) => within(row).queryByText(/alex@example.com/i));

    expect(rows.length).toBeGreaterThan(1);
    expect(matchRow).toBeDefined();
    expect(within(matchRow!).queryAllByText(/alex doe/i).length).toBeGreaterThan(0);
    expect(within(matchRow!).queryAllByText(/engineer/i).length).toBeGreaterThan(0);
    expect(within(matchRow!).getByText(/0\.82/)).toBeInTheDocument();
  });

  it("surfaces matcher errors without populating matches", async () => {
    const user = userEvent.setup();

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );

    render(<RunMatcherView />);

    await user.click(screen.getByRole("button", { name: /run matcher/i }));

    expect(await screen.findByText(/could not run matcher/i)).toBeInTheDocument();
    expect(screen.getByText(/no matches yet/i)).toBeInTheDocument();
  });

  it("renders job table rows with freshness and links", () => {
    render(
      <JobTable
        jobs={[
          {
            id: "job-1",
            title: "Frontend Engineer",
            customerName: "Acme",
            location: "Remote",
            source: "Referral",
            createdAt: new Date("2024-02-02").toISOString(),
            updatedAt: new Date("2024-02-03").toISOString(),
            latestMatchActivity: null,
          },
        ]}
      />,
    );

    const table = screen.getByRole("table");

    expect(within(table).getByRole("link", { name: /frontend engineer/i })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: /acme/i })).toBeInTheDocument();
  });

  it("renders candidate job opportunities table", () => {
    render(
      <JobOpportunitiesTable
        jobs={[
          {
            id: "op-1",
            jobReqId: "job-1",
            title: "Data Scientist",
            location: "NYC",
            customerName: "Beta Co",
            status: "SHORTLISTED",
            matchScore: 0.87,
          },
        ]}
      />,
    );

    const table = screen.getByRole("table");

    expect(within(table).getByRole("link", { name: /data scientist/i })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: /beta co/i })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: /87%/i })).toBeInTheDocument();
  });

  it("renders job matches table entries", () => {
    render(
      <JobMatchesTable
        matches={[
          {
            id: "match-1",
            candidateId: "cand-1",
            jobId: "job-1",
            candidateName: "Jordan",
            currentTitle: "Engineer",
            score: 0.75,
            jobCandidateId: "jc-1",
            jobCandidateStatus: JobCandidateStatus.SHORTLISTED,
          },
        ]}
        jobTitle="Job title"
        jobId="job-1"
      />,
    );

    const table = screen.getByRole("table");
    const row = within(table).getByRole("row", { name: /engineer/i });

    expect(screen.getByLabelText(/shortlist jordan/i)).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: /engineer/i })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: /0\.75/ })).toBeInTheDocument();
  });

  it("renders admin environment table entries", () => {
    render(
      <EnvTable
        entries={[
          { key: "API_KEY", value: "****", redacted: true },
          { key: "FEATURE_X", value: "on", redacted: false },
        ]}
      />,
    );

    const table = screen.getByRole("table");

    expect(within(table).getByRole("cell", { name: /api_key/i })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: /visible/i })).toBeInTheDocument();
  });
});
