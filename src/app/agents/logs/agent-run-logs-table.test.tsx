/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AgentRunLogsTable,
  AgentRunLogTableRow,
  formatDurationMs,
} from "./agent-run-logs-table";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const baseLog: AgentRunLogTableRow = {
  id: "base",
  agentName: "Agent Alpha",
  startedAt: "2024-06-01T12:00:00.000Z",
  status: "SUCCESS",
  userLabel: "Recruiter A",
  inputSnapshot: {},
  outputSnapshot: {},
  errorMessage: null,
  errorCategory: null,
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
    errorCategory: "AI",
  },
  {
    ...baseLog,
    id: "partial-1",
    agentName: "Agent Gamma",
    status: "PARTIAL",
    startedAt: "2024-06-03T08:30:00.000Z",
    durationMs: 800,
    errorCategory: "DATA",
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

    const statusFilter = screen.getByRole("button", { name: /Status: All/i });
    fireEvent.click(statusFilter);

    const runningCheckbox = screen.getByLabelText("Running");
    fireEvent.click(runningCheckbox);
    expect(screen.getByText("No runs match the selected filters.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear"));
    expect(getBodyRows()).toHaveLength(sampleLogs.length);

    const successCheckbox = screen.getByLabelText("Success");
    fireEvent.click(successCheckbox);

    const rowsAfterFilter = getBodyRows();
    expect(rowsAfterFilter).toHaveLength(1);
    expect(within(rowsAfterFilter[0]).getByText("Agent Alpha")).toBeInTheDocument();
  });

  it("filters rows by error type", () => {
    render(<AgentRunLogsTable logs={sampleLogs} selectedId="base" onSelect={() => {}} />);

    const errorFilter = screen.getByRole("button", { name: /Error type: All/i });
    fireEvent.click(errorFilter);

    fireEvent.click(screen.getByLabelText("AI failure"));

    const rowsAfterFilter = getBodyRows();
    expect(rowsAfterFilter).toHaveLength(1);
    expect(within(rowsAfterFilter[0]).getByText("Agent Beta")).toBeInTheDocument();
  });

  it("applies search and filter selections together", () => {
    render(<AgentRunLogsTable logs={sampleLogs} selectedId="base" onSelect={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/search runs/i), { target: { value: "Recruiter" } });
    expect(getBodyRows()).toHaveLength(sampleLogs.length);

    const agentFilter = screen.getByRole("button", { name: /Agent: All/i });
    fireEvent.click(agentFilter);
    fireEvent.click(screen.getByLabelText("Agent Gamma"));

    const rowsAfterFilter = getBodyRows();
    expect(rowsAfterFilter).toHaveLength(1);
    expect(within(rowsAfterFilter[0]).getByText("Agent Gamma")).toBeInTheDocument();
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
});
