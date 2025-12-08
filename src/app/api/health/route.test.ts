/// <reference types="vitest/globals" />

import { GET } from "./route";
import { recordHealthCheck, runHealthChecks } from "@/lib/health";

vi.mock("@/lib/health", () => {
  return {
    runHealthChecks: vi.fn(),
    recordHealthCheck: vi.fn(),
  };
});

describe("GET /api/health", () => {
  const okReport = {
    status: "ok" as const,
    timestamp: "2025-01-01T00:00:00.000Z",
    checks: [
      { name: "environment", status: "ok" as const, message: "envs" },
      { name: "database", status: "ok" as const, message: "db" },
    ],
  };

  const errorReport = {
    status: "error" as const,
    timestamp: "2025-01-01T00:00:01.000Z",
    checks: [
      { name: "environment", status: "error" as const, message: "missing" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and persists a successful health check", async () => {
    vi.mocked(runHealthChecks).mockResolvedValue(okReport);

    const response = await GET();
    const payload = await response.json();

    expect(runHealthChecks).toHaveBeenCalledTimes(1);
    expect(recordHealthCheck).toHaveBeenCalledWith(okReport);
    expect(response.status).toBe(200);
    expect(payload).toEqual(okReport);
  });

  it("returns 503 when a check fails", async () => {
    vi.mocked(runHealthChecks).mockResolvedValue(errorReport);

    const response = await GET();
    const payload = await response.json();

    expect(runHealthChecks).toHaveBeenCalledTimes(1);
    expect(recordHealthCheck).toHaveBeenCalledWith(errorReport);
    expect(response.status).toBe(503);
    expect(payload).toEqual(errorReport);
  });

  it("logs when persisting the health check fails", async () => {
    vi.mocked(runHealthChecks).mockResolvedValue(okReport);
    vi.mocked(recordHealthCheck).mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();

    expect(runHealthChecks).toHaveBeenCalledTimes(1);
    expect(recordHealthCheck).toHaveBeenCalledWith(okReport);
    expect(errorSpy).toHaveBeenCalledWith(
      "[health] Failed to persist AgentRunLog",
      expect.any(Error),
    );
    expect(response.status).toBe(200);

    errorSpy.mockRestore();
  });
});
