/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AgentRunLogsTable,
  AgentRunLogTableRow,
  filterLogsBySelections,
  formatDurationMs,
} from "./agent-run-logs-table";

const baseLog: AgentRunLogTableRow = {
  id: "base",
  agentName: "Agent Alpha",
  startedAt: "2024-06-01T12:00:00.000Z",
  status: "SUCCESS",
  userLabel: "Recruiter A",
  inputSnapshot: {},
  outputSnapshot: {},
  errorMessage: null,
  retryCount: 0,
  retryOfId: null,
  durationMs: 1200,
  finishedAt: "2024-06-01T12:00:01.200Z",
};

const sampleLogs: AgentRunLogTableRow[] = [
  baseLog,
  {
    ...baseLog,
    id: "fail-1",
    agentName: "Agent Beta",
    status: "FAILED",
    startedAt: "2024-06-02T15:00:00.000Z",
    durationMs: 2500,
    userLabel: "Recruiter B",
  },
  {
    ...baseLog,
    id: "partial-1",
    agentName: "Agent Gamma",
    status: "PARTIAL",
    startedAt: "2024-06-03T08:30:00.000Z",
    durationMs: 800,
  },
];

function getBodyRows() {
  return screen
    .getAllByRole("row")
    .filter((row) => row.querySelector("td"));
}

describe("AgentRunLogsTable", () => {
  it("renders the provided logs in the table", () => {
    render(<AgentRunLogsTable logs={sampleLogs} selectedId="base" onSelect={() => {}} />);

    expect(screen.getByText("Agent Alpha")).toBeInTheDocument();
    expect(screen.getByText("Agent Beta")).toBeInTheDocument();
    expect(screen.getByText("Agent Gamma")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
  });

  it("filters rows by selected status values", () => {
    render(<AgentRunLogsTable logs={sampleLogs} selectedId="base" onSelect={() => {}} />);

    const statusFilter = within(screen.getByTestId("status-filter")).getByRole("button");
    fireEvent.click(statusFilter);

    const runningCheckbox = screen.getByLabelText("Running") as HTMLInputElement;
    fireEvent.click(runningCheckbox);
    expect(screen.getByText("No runs match the selected filters.")).toBeInTheDocument();

    const clearButton = screen.getByText("Clear");
    fireEvent.click(clearButton);
    expect(getBodyRows()).toHaveLength(sampleLogs.length);

    const successCheckbox = screen.getByLabelText("Success") as HTMLInputElement;
    fireEvent.click(successCheckbox);

    const rowsAfterFilter = getBodyRows();
    expect(rowsAfterFilter).toHaveLength(1);
    expect(within(rowsAfterFilter[0]).getByText("Agent Alpha")).toBeInTheDocument();
  });

  it("sorts by timestamp when the header is toggled", () => {
    render(<AgentRunLogsTable logs={sampleLogs} selectedId="base" onSelect={() => {}} />);

    let rows = getBodyRows();
    expect(within(rows[0]).getByText("Agent Gamma")).toBeInTheDocument();

    const timestampHeader = screen.getByRole("button", { name: /Timestamp/ });
    fireEvent.click(timestampHeader);

    rows = getBodyRows();
    expect(within(rows[0]).getByText("Agent Alpha")).toBeInTheDocument();
  });

  it("invokes the selection handler when a row is clicked", () => {
    const handleSelect = vi.fn();
    render(<AgentRunLogsTable logs={sampleLogs} selectedId="base" onSelect={handleSelect} />);

    const rows = getBodyRows();
    fireEvent.click(rows[1]);

    expect(handleSelect).toHaveBeenCalledWith("fail-1");
  });
});

describe("AgentRunLogsTable helpers", () => {
  it("formats duration values", () => {
    expect(formatDurationMs(undefined)).toBe("—");
    expect(formatDurationMs(800)).toBe("800 ms");
    expect(formatDurationMs(1500)).toBe("1.5 s");
    expect(formatDurationMs(65000)).toBe("1m 5s");
  });

  it("filters logs by agent and status selections", () => {
    const filteredByStatus = filterLogsBySelections(sampleLogs, [], ["FAILED"]);
    expect(filteredByStatus).toHaveLength(1);
    expect(filteredByStatus[0]?.id).toBe("fail-1");

    const filteredByAgent = filterLogsBySelections(sampleLogs, ["Agent Gamma"], []);
    expect(filteredByAgent).toHaveLength(1);
    expect(filteredByAgent[0]?.id).toBe("partial-1");
  });
});
