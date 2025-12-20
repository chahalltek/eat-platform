import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as logDecisionItem } from "@/app/api/decision-stream/item/route";
import { makeNextRequest, readJson } from "@tests/helpers";

const mocks = vi.hoisted(() => ({
  requireRecruiterOrAdmin: vi.fn(),
  recordMetricEvent: vi.fn(),
  metricEventFindFirst: vi.fn(),
  metricEventCreate: vi.fn(),
}));

vi.mock("@/lib/auth/requireRole", () => ({ requireRecruiterOrAdmin: mocks.requireRecruiterOrAdmin }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mocks.recordMetricEvent }));
vi.mock("@/server/db/prisma", () => ({
  prisma: {
    metricEvent: {
      findFirst: mocks.metricEventFindFirst,
      create: mocks.metricEventCreate,
    },
  },
}));

describe("Decision stream item route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireRecruiterOrAdmin.mockResolvedValue({
      ok: true,
      user: { id: "user-1", tenantId: "tenant-1", email: "user@example.com", role: "RECRUITER" },
    });
    mocks.recordMetricEvent.mockResolvedValue(undefined);
  });

  it("defaults confidence to 5 when not provided", async () => {
    const request = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/decision-stream/item",
      json: {
        streamId: "stream-1",
        jobId: "job-1",
        candidateId: "cand-1",
        action: "SHORTLISTED",
        label: "Shortlisted from console",
      },
    });

    const response = await logDecisionItem(request);
    const body = await readJson<{ ok: boolean }>(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.recordMetricEvent).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      eventType: "DECISION_STREAM_ITEM",
      entityId: "stream-1",
      meta: expect.objectContaining({
        confidence: { score: 5, band: null },
        action: "SHORTLISTED",
        candidateId: "cand-1",
      }),
    });
  });

  it("persists provided confidence and outcome details", async () => {
    const request = makeNextRequest({
      method: "POST",
      url: "http://localhost/api/decision-stream/item",
      json: {
        streamId: "stream-2",
        jobId: "job-2",
        candidateId: "cand-2",
        action: "REMOVED",
        confidence: 8.4,
        confidenceBand: "HIGH",
        outcome: "Rejected by HM",
      },
    });

    const response = await logDecisionItem(request);
    const body = await readJson<{ ok: boolean }>(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.recordMetricEvent).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      eventType: "DECISION_STREAM_ITEM",
      entityId: "stream-2",
      meta: expect.objectContaining({
        confidence: { score: 8.4, band: "HIGH" },
        outcome: "Rejected by HM",
        candidateId: "cand-2",
      }),
    });
  });
});
