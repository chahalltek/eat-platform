/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { FulfillmentJobsTable } from "../table/FulfillmentJobsTable";
import type { FulfillmentJobRecord } from "../data";

const sampleJobs: FulfillmentJobRecord[] = [
  {
    id: "job-1",
    title: "Platform Engineer",
    client: "Acme",
    status: "Sourcing",
    priority: "P1 - High",
    updatedAt: new Date("2024-04-10T12:00:00Z").toISOString(),
    owner: "Casey",
    needsAction: true,
    location: "Remote",
    summary: "",
    source: "seed",
  },
  {
    id: "job-2",
    title: "Customer Success",
    client: "Globex",
    status: "On Hold",
    priority: "P2 - Standard",
    updatedAt: new Date("2024-04-09T12:00:00Z").toISOString(),
    owner: "Jordan",
    needsAction: false,
    location: "NYC",
    summary: "",
    source: "seed",
  },
];

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("FulfillmentJobsTable", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("renders rows and columns", () => {
    render(<FulfillmentJobsTable jobs={sampleJobs} />);

    const table = screen.getByRole("table", { name: /fulfillment jobs/i });
    expect(within(table).getByRole("columnheader", { name: /job/i })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /priority/i })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: /acme/i })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: /p1 - high/i })).toBeInTheDocument();
  });

  it("navigates when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<FulfillmentJobsTable jobs={sampleJobs} />);

    const firstRow = within(screen.getByRole("table", { name: /fulfillment jobs/i })).getAllByRole("row")[1];
    await user.click(firstRow);

    expect(pushMock).toHaveBeenCalledWith("/fulfillment/jobs/job-1");
  });

  it("shows empty state", () => {
    render(<FulfillmentJobsTable jobs={[]} />);
    expect(screen.getByText(/no fulfillment jobs available/i)).toBeInTheDocument();
  });
});
