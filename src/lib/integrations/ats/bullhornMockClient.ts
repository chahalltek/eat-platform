import type { AtsCandidateSummary } from "./types";
import type { BullhornAtsClient, BullhornWebhookEvent } from "./bullhornAdapter";
import type { BullhornCandidate, BullhornJob, BullhornPlacement } from "../bullhorn/types";

export interface MockBullhornData {
  jobs?: BullhornJob[];
  candidates?: BullhornCandidate[];
  placements?: BullhornPlacement[];
}

export class MockBullhornAtsClient implements BullhornAtsClient {
  private readonly jobs: Map<string, BullhornJob>;
  private readonly candidates: Map<string, BullhornCandidate>;
  private readonly placements: Map<string, BullhornPlacement>;
  readonly shortlistRequests: Array<{ jobId: string; note?: string; candidates: AtsCandidateSummary[] }> = [];

  constructor(data: MockBullhornData = {}) {
    this.jobs = new Map((data.jobs ?? []).map((job) => [String(job.id), job]));
    this.candidates = new Map((data.candidates ?? []).map((candidate) => [String(candidate.id), candidate]));
    this.placements = new Map((data.placements ?? []).map((placement) => [String(placement.id), placement]));
  }

  async fetchJob(jobId: string): Promise<BullhornJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    return job;
  }

  async fetchCandidate(candidateId: string): Promise<BullhornCandidate> {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} not found`);
    return candidate;
  }

  async fetchPlacement(placementId: string): Promise<BullhornPlacement | null> {
    return this.placements.get(placementId) ?? null;
  }

  async fetchShortlistCandidates(_jobId: string): Promise<BullhornCandidate[]> {
    return Array.from(this.candidates.values());
  }

  async pushShortlist(jobId: string, candidates: AtsCandidateSummary[], note?: string): Promise<string[]> {
    this.shortlistRequests.push({ jobId, note, candidates });
    const noteSuffix = note ? `-${note}` : "";
    return candidates.map((candidate, index) => `${jobId}-${index + 1}-${candidate.id}${noteSuffix}`);
  }
}

export function buildPlacementEvent(placement: BullhornPlacement): BullhornWebhookEvent {
  return {
    eventId: `evt-${placement.id}`,
    entityName: "Placement",
    entityId: placement.id,
    eventType: placement.status ?? "UPDATED",
    timestamp: placement.startDate ?? placement.endDate ?? new Date().toISOString(),
    placement,
  };
}

export function buildSubmissionEvent(params: {
  id: string | number;
  jobId: string | number;
  candidateId: string | number;
  status?: string;
  fromStage?: string | null;
  timestamp?: string | number;
}): BullhornWebhookEvent {
  return {
    eventId: `evt-submission-${params.id}`,
    entityName: "JobSubmission",
    entityId: params.id,
    jobId: params.jobId,
    candidateId: params.candidateId,
    eventType: params.status ?? "UPDATED",
    status: params.status,
    fromStage: params.fromStage,
    timestamp: params.timestamp,
  };
}
