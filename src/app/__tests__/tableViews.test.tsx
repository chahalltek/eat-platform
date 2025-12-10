/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { JobCandidateStatus } from "@prisma/client";

import { AgentRunsTable } from "../agents/runs/AgentRunsTable";
import { EnvTable } from "../admin/env/EnvTable";
import { JobMatchesTable } from "../jobs/[jobId]/matches/JobMatchesTable";
import { JobTable } from "../jobs/JobTable";
import { JobOpportunitiesTable } from "../candidates/JobOpportunitiesTable";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

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
