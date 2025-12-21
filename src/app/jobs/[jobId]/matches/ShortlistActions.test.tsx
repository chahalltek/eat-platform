/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MatchRow } from "./JobMatchesTable";
import { ShortlistActions, buildShortlistClipboard, buildShortlistCsv, buildShortlistRows } from "./ShortlistActions";

const shortlistedMatch: MatchRow = {
  id: "match-1",
  candidateId: "cand-1",
  jobId: "job-1",
  jobTitle: "Data Scientist",
  candidateName: "A Candidate",
  currentTitle: "Senior Analyst",
  score: 0.82,
  confidenceScore: 0.86,
  confidenceCategory: "High",
  shortlisted: true,
  explanation: {
    topReasons: ["Strong SQL coverage", "Led experimentation roadmap"],
    riskAreas: ["Limited industry depth"],
  },
  keySkills: ["Python", "Experimentation"],
};

describe("ShortlistActions exports", () => {
  it("formats clipboard payload with strengths, risks, and confidence", () => {
    const rows = buildShortlistRows([shortlistedMatch]);
    const clipboard = buildShortlistClipboard("Data Scientist", "job-1", rows);

    expect(clipboard).toContain("| Name | Title | Key strengths | Risks | Confidence |");
    expect(clipboard).toContain("A Candidate");
    expect(clipboard).toContain("Strong SQL coverage; Led experimentation roadmap; Python coverage");
    expect(clipboard).toContain("Limited industry depth");
    expect(clipboard).toMatch(/86% \(High\)/);
  });

  it("generates csv rows with the same column order", () => {
    const rows = buildShortlistRows([shortlistedMatch]);
    const csv = buildShortlistCsv(rows);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("\"Name\",\"Title\",\"Key strengths\",\"Risks\",\"Confidence\"");
    expect(lines[1]).toContain("\"A Candidate\"");
    expect(lines[1]).toContain("Strong SQL coverage; Led experimentation roadmap; Python coverage");
    expect(lines[1]).toContain("Limited industry depth");
  });

  it("disables exporting when decision.export is missing", () => {
    render(<ShortlistActions jobId="job-1" jobTitle="Data Scientist" matches={[shortlistedMatch]} canExportDecisions={false} />);

    expect(screen.getByRole("button", { name: /copy to clipboard/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /download csv/i })).toBeDisabled();
    expect(screen.getByText(/decision\.export is required/i)).toBeInTheDocument();
  });
});
