/// <reference types="vitest/globals" />

import { GET, OPTIONS, POST, resetProcessedEventIds } from "./route";

const buildRequest = (body: unknown, signature = "secret") =>
  new Request("http://localhost/api/ats/bullhorn/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bullhorn-signature": signature,
    },
    body: JSON.stringify(body),
  });

describe("POST /api/ats/bullhorn/webhook", () => {
  beforeEach(() => {
    resetProcessedEventIds();
    process.env.BULLHORN_WEBHOOK_SECRET = "secret";
  });

  afterEach(() => {
    delete process.env.BULLHORN_WEBHOOK_SECRET;
  });

  const validEvent = {
    eventId: "evt-1",
    entityName: "Candidate",
    entityId: 123,
    eventType: "UPDATED",
    updatedProperties: ["status"],
  };

  it("rejects payloads that fail validation", async () => {
    const response = await POST(buildRequest({ bad: "data" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("subscriptionId");
  });

  it("rejects requests with an invalid signature", async () => {
    const response = await POST(buildRequest({ subscriptionId: "sub-1", events: [validEvent] }, "invalid"));

    expect(response.status).toBe(401);
  });

  it("ignores duplicate events while still accepting valid payloads", async () => {
    const payload = { subscriptionId: "sub-1", events: [validEvent] };

    const firstResponse = await POST(buildRequest(payload));
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(202);
    expect(firstBody.processed).toBe(1);
    expect(firstBody.duplicates).toBe(0);

    const secondResponse = await POST(buildRequest(payload));
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(202);
    expect(secondBody.processed).toBe(0);
    expect(secondBody.duplicates).toBe(1);
  });
});

describe("Non-POST methods", () => {
  it("responds to GET with a simple ok payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "ok" });
  });

  it("responds to OPTIONS with an empty 204", async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get("allow")).toBe("GET,POST,OPTIONS");
  });
});
