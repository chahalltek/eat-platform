// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AgentRunLogsView from "@/app/agents/logs/logs-view";
import type { SerializableLog } from "@/app/agents/logs/types";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const baseLog: SerializableLog = {
  id: "log-1",
  agentName: "ETE-TS.RINA",
  status: "SUCCESS",
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 100,
  userLabel: "Test User",
  inputSnapshot: { rawResumeText: "resume" },
  outputSnapshot: { candidateId: "candidate-1" },
  errorMessage: null,
  errorCategory: null,
  retryCount: 0,
  retryOfId: null,
};

describe("AgentRunLogsView retry UX", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
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

  beforeEach(() => {
    mockRefresh.mockClear();
  });

  afterEach(() => {
    // @ts-expect-error - cleanup test fetch override
    delete global.fetch;
    vi.clearAllMocks();
  });

  it("shows a success message when retry starts", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agentRunId: "retry-1", retryCount: 1 }),
    });

    // @ts-expect-error - overriding global fetch for the test environment
    global.fetch = fetchMock;

    render(<AgentRunLogsView logs={[baseLog]} />);

    await user.click(screen.getByRole("button", { name: /retry run/i }));

    await waitFor(() => {
      expect(screen.getByText(/Retry started/)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("surfaces a friendly message when retry input is missing", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        errorCode: "MISSING_RETRY_INPUT",
        message: "This run cannot be retried because the original resume text is missing.",
      }),
    });

    // @ts-expect-error - overriding global fetch for the test environment
    global.fetch = fetchMock;

    render(<AgentRunLogsView logs={[baseLog]} />);

    await user.click(screen.getByRole("button", { name: /retry run/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /This run cannot be retried because the original resume text is missing. New runs will store this data for retry./i,
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry run/i })).toBeDisabled();
  });
});
