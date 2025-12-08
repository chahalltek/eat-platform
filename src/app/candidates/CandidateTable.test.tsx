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
<<<<<<< ours
    status: "Active",
    parsingConfidence: 0.82,
=======
    confidenceScore: 82,
>>>>>>> theirs
    updatedAt: "2024-05-01T12:00:00.000Z",
  },
  {
    id: "2",
    fullName: "Bob Smith",
    currentTitle: null,
    location: "Remote",
<<<<<<< ours
    status: "Active",
    parsingConfidence: 0.61,
=======
    confidenceScore: 61,
>>>>>>> theirs
    updatedAt: "2024-05-03T12:00:00.000Z",
  },
  {
    id: "3",
    fullName: "Carol Lee",
    currentTitle: "Product Manager",
    location: null,
<<<<<<< ours
    status: "Placed",
    parsingConfidence: 0.95,
=======
    confidenceScore: 95,
>>>>>>> theirs
    updatedAt: "2024-04-25T12:00:00.000Z",
  },
  {
    id: "4",
    fullName: "Dana Null",
    currentTitle: "Quality Analyst",
    location: "Chicago, IL",
<<<<<<< ours
    status: null,
    parsingConfidence: null,
=======
    confidenceScore: 55,
>>>>>>> theirs
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
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /score/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /last updated/i })).toBeTruthy();

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(candidates.length + 1);
    expect(screen.getAllByText("Frontend Engineer")).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("sorts by confidence score when the header is clicked", async () => {
    render(<CandidateTable candidates={candidates} />);

    const confidenceHeader = screen.getByRole("button", { name: /score/i });

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

  it("filters by status and location", async () => {
    render(<CandidateTable candidates={candidates} />);

    fireEvent.click(screen.getByRole("button", { name: /Status: All/i }));
    fireEvent.click(screen.getByLabelText("Active"));

    fireEvent.click(screen.getByRole("button", { name: /Location: All/i }));
    fireEvent.click(screen.getByLabelText("Remote"));

    await waitFor(() => expect(getRenderedNames()).toEqual(["Bob Smith"]));
  });
});
