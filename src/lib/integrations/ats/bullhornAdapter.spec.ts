import { describe, expect, it } from "vitest";
import { buildPlacementEvent, buildSubmissionEvent, MockBullhornAtsClient } from "./bullhornMockClient";
import { BullhornAtsAdapter, normalizeBullhornWebhookEvent } from "./bullhornAdapter";
import { InMemoryAtsEventStore } from "./types";

const job = {
  id: 99,
  title: "Platform Engineer",
  employmentType: "Full-Time",
  address: { city: "Remote", country: "USA" },
  dateAdded: "2025-01-01T00:00:00Z",
  isOpen: true,
  clientCorporation: { name: "Acme" },
};

const candidate = {
  id: 501,
  firstName: "Casey",
  lastName: "Lee",
  email: "casey@example.com",
  phone: "+18885551212",
  city: "Remote",
  country: "USA",
  dateAdded: "2025-01-02T12:00:00Z",
  source: "Referral",
};

const placement = {
  id: 701,
  jobOrder: job,
  candidate,
  startDate: "2025-02-01T00:00:00Z",
  status: "Placed",
};

describe("BullhornAtsAdapter", () => {
  it("ingests jobs and candidates through the ATS seam", async () => {
    const client = new MockBullhornAtsClient({ jobs: [job], candidates: [candidate] });
    const store = new InMemoryAtsEventStore();
    const adapter = new BullhornAtsAdapter(client, store);

    const mappedJob = await adapter.ingestJob("99");
    expect(mappedJob).toMatchObject({
      id: "99",
      title: "Platform Engineer",
      department: "Acme",
      status: "open",
      location: "Remote, USA",
    });

    const ingest = await adapter.ingestCandidate("99", "501");
    expect(ingest.job.id).toBe("99");
    expect(ingest.candidate).toMatchObject({
      id: "501",
      fullName: "Casey Lee",
      email: "casey@example.com",
      source: "Referral",
    });
  });

  it("pushes shortlists and records external ids", async () => {
    const client = new MockBullhornAtsClient({ jobs: [job], candidates: [candidate] });
    const store = new InMemoryAtsEventStore();
    const adapter = new BullhornAtsAdapter(client, store);

    const shortlist = await adapter.ingestShortlist("99");
    const result = await adapter.pushShortlist({ jobId: "99", candidates: shortlist.candidates, note: "top picks" });

    expect(result.externalCandidateIds[0]).toContain("top picks");
    expect(store.shortlistPushes[0]?.pushed).toBe(result.pushed);
  });

  it("normalizes webhook payloads for submissions and placements", async () => {
    const client = new MockBullhornAtsClient({ jobs: [job], candidates: [candidate], placements: [placement] });
    const store = new InMemoryAtsEventStore();
    const adapter = new BullhornAtsAdapter(client, store);

    const submissionEnvelope = await normalizeBullhornWebhookEvent(
      buildSubmissionEvent({
        id: 123,
        jobId: job.id,
        candidateId: candidate.id,
        status: "Interview",
        fromStage: "Applied",
        timestamp: "2025-01-03T12:00:00Z",
      }),
    );

    const placementEnvelope = await normalizeBullhornWebhookEvent(
      buildPlacementEvent(placement),
      { lookupPlacement: (id) => client.fetchPlacement(id) },
    );

    if (!submissionEnvelope || !placementEnvelope) {
      throw new Error("Webhook normalization failed");
    }

    await adapter.receiveOutcome(submissionEnvelope);
    await adapter.receiveOutcome(placementEnvelope);

    expect(store.stageChanges[0]).toMatchObject({
      jobId: "99",
      candidateId: "501",
      fromStage: "Applied",
      toStage: "Interview",
      metadata: expect.objectContaining({ entityName: "JobSubmission" }),
    });

    expect(store.outcomes[0]).toMatchObject({
      jobId: "99",
      candidateId: "501",
      outcome: "Placed",
      metadata: expect.objectContaining({ entityName: "Placement" }),
    });
  });
});
