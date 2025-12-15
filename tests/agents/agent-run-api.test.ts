import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { POST as runAgentPost } from "@/app/api/agents/agent/run/route";
import { makeNextRequest, readJson } from "@tests/helpers";

const { mockGetCurrentUser, mockAgentHandler } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockAgentHandler: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/server/agents/registry", () => ({
  AgentRegistry: {
    "TEST.AGENT": {
      key: "TEST.AGENT",
      displayName: "Test Agent",
      description: "A test agent",
      run: mockAgentHandler,
    },
  },
}));

const buildRequest = (agentName: string, json?: unknown) =>
  makeNextRequest({ method: "POST", url: `http://localhost/api/agents/agent/run?agent=${agentName}`, json });

describe("agent run API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: null, displayName: "Test User", role: "USER" });
  });

  it("routes payloads to the requested agent", async () => {
    mockAgentHandler.mockResolvedValue({ agentRunId: "run-1", result: "ok" });

    const response = await runAgentPost(buildRequest("TEST.AGENT", { payload: "data" }));
    const body = await readJson<{ ok: boolean; result: unknown; traceId: string | null }>(response);

    expect(response.status).toBe(200);
    expect(mockAgentHandler).toHaveBeenCalledWith({
      input: { payload: "data" },
      ctx: { currentUser: { id: "user-1", email: null, displayName: "Test User", role: "USER" }, req: expect.anything() },
    });
    expect(body).toEqual({ ok: true, result: { agentRunId: "run-1", result: "ok" }, traceId: "run-1" });
  });

  it("requires authentication", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await runAgentPost(buildRequest("TEST.AGENT", { foo: "bar" }));
    const body = await readJson<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockAgentHandler).not.toHaveBeenCalled();
  });

  it("returns a not-found response for unknown agents", async () => {
    const response = await runAgentPost(buildRequest("MISSING.AGENT", { foo: "bar" }));
    const body = await readJson<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Agent not found" });
  });

  it("passes through agent-level responses", async () => {
    const errorResponse = NextResponse.json({ error: "Bad input" }, { status: 422 });
    mockAgentHandler.mockRejectedValue(errorResponse);

    const response = await runAgentPost(buildRequest("TEST.AGENT", { foo: "bar" }));
    const body = await readJson<{ error: string }>(response);

    expect(response.status).toBe(422);
    expect(body).toEqual({ error: "Bad input" });
  });
});
