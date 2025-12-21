/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSystemMapHealth } from "@/lib/hooks/useSystemMapHealth";

describe("useSystemMapHealth", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        nodes: {
          intake: { status: "healthy" },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("polls when enabled and stops when disabled", async () => {
    const { rerender } = renderHook(({ enabled }) => useSystemMapHealth(enabled), {
      initialProps: { enabled: false },
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ enabled: true });
    });

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    const callsAfterEnable = fetchMock.mock.calls.length;
    expect(callsAfterEnable).toBeGreaterThanOrEqual(1);

    await act(async () => {
      rerender({ enabled: false });
      vi.runOnlyPendingTimers();
    });

    const callCountAfterDisable = fetchMock.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(fetchMock.mock.calls.length).toBe(callCountAfterDisable);
  });
});
