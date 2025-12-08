/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CandidateTable, type CandidateRow } from "./CandidateTable";

const candidates: CandidateRow[] = [
  {
    id: "1",
    fullName: "Alice Doe",
    currentTitle: "Frontend Engineer",
    location: "New York, NY",
    parsingConfidence: 0.82,
    updatedAt: "2024-05-01T12:00:00.000Z",
  },
  {
    id: "2",
    fullName: "Bob Smith",
    currentTitle: null,
    location: "Remote",
    parsingConfidence: 0.61,
    updatedAt: "2024-05-03T12:00:00.000Z",
  },
  {
    id: "3",
    fullName: "Carol Lee",
    currentTitle: "Product Manager",
    location: null,
    parsingConfidence: 0.95,
    updatedAt: "2024-04-25T12:00:00.000Z",
  },
  {
    id: "4",
    fullName: "Dana Null",
    currentTitle: "Quality Analyst",
    location: "Chicago, IL",
    parsingConfidence: null,
    updatedAt: "2024-05-04T12:00:00.000Z",
  },
];

function getRenderedNames() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).queryByRole("link")?.textContent ?? row.textContent?.trim() ?? "");
}

describe("CandidateTable", () => {
  it("renders candidate data with expected columns", () => {
    render(<CandidateTable candidates={candidates} />);

    expect(screen.getByRole("columnheader", { name: /candidate/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /primary role/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /location/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /confidence/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /last updated/i })).toBeTruthy();

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(candidates.length + 1);
    expect(screen.getAllByText("Frontend Engineer")).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("sorts by confidence score when the header is clicked", async () => {
    render(<CandidateTable candidates={candidates} />);

    const confidenceHeader = screen.getByRole("button", { name: /confidence/i });

    fireEvent.click(confidenceHeader);
    await waitFor(() => expect(getRenderedNames()).toEqual(["Carol Lee", "Alice Doe", "Bob Smith", "Dana Null"]));

    fireEvent.click(confidenceHeader);
    await waitFor(() => expect(getRenderedNames()).toEqual(["Dana Null", "Bob Smith", "Alice Doe", "Carol Lee"]));
  });

  it("filters rows when the search query is updated and shows an empty state", async () => {
    render(<CandidateTable candidates={candidates} />);

    const searchInput = screen.getByPlaceholderText(/search by name, role, or location/i);

    fireEvent.change(searchInput, { target: { value: "smith" } });
    await waitFor(() => expect(getRenderedNames()).toEqual(["Bob Smith"]));

    fireEvent.change(searchInput, { target: { value: "does-not-exist" } });
    await waitFor(() => expect(screen.getByText("No candidates found.")).toBeTruthy());
  });
});
