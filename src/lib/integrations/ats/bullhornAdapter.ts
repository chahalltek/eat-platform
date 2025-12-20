import { mapBullhornCandidate, mapBullhornJob, mapBullhornPlacement } from "../bullhorn/mappings";
import type {
  BullhornCandidate,
  BullhornJob,
  BullhornPlacement,
  MappedCandidate,
  MappedJob,
  MappedPlacement,
} from "../bullhorn/types";
import type {
  AtsAdapter,
  AtsCandidateSummary,
  AtsEventStore,
  AtsJob,
  AtsWebhookEnvelope,
  CandidateIngestResult,
  OutcomeEvent,
  OutcomeReceipt,
  ShortlistPushPayload,
  ShortlistPushResult,
  StageChangeEvent,
} from "./types";

export interface BullhornAtsClient {
  fetchJob(jobId: string): Promise<BullhornJob>;
  fetchCandidate(candidateId: string): Promise<BullhornCandidate>;
  fetchPlacement?(placementId: string): Promise<BullhornPlacement | null>;
  fetchShortlistCandidates?(jobId: string): Promise<BullhornCandidate[]>;
  pushShortlist?(jobId: string, candidates: AtsCandidateSummary[], note?: string): Promise<string[]>;
}

export type BullhornWebhookEvent = {
  eventId: string;
  entityName: string;
  entityId: string | number;
  eventType: string;
  updatedProperties?: string[];
  timestamp?: string | number;
  jobId?: string | number;
  candidateId?: string | number;
  status?: string;
  fromStage?: string | null;
  placement?: BullhornPlacement;
};

const DEFAULT_STATUS = "open";

function coerceDate(value?: string | number): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toAtsJob(raw: BullhornJob, mapped: MappedJob): AtsJob {
  return {
    id: mapped.id,
    title: mapped.title,
    location: mapped.location,
    department: mapped.company ?? null,
    status: raw.isOpen === false ? "closed" : DEFAULT_STATUS,
    openedAt: mapped.postedAt,
    externalUrl: null,
  };
}

function toAtsCandidate(raw: BullhornCandidate, mapped: MappedCandidate): AtsCandidateSummary {
  return {
    id: mapped.id,
    fullName: mapped.fullName,
    email: mapped.email,
    phone: mapped.phone,
    resumeUrl: null,
    appliedAt: mapped.createdAt,
    stage: null,
    source: mapped.source,
  };
}

function mapPlacementOutcome(placement: BullhornPlacement, mapped: MappedPlacement): OutcomeEvent {
  return {
    jobId: mapped.jobId ?? (placement.jobOrder ? String(placement.jobOrder.id) : String(placement.id)),
    candidateId: mapped.candidateId ?? (placement.candidate ? String(placement.candidate.id) : String(placement.id)),
    outcome: mapped.status ?? "Updated",
    decidedAt: coerceDate(placement.startDate ?? placement.endDate),
  };
}

export async function normalizeBullhornWebhookEvent(
  event: BullhornWebhookEvent,
  deps: { lookupPlacement?: (placementId: string) => Promise<BullhornPlacement | null> } = {},
): Promise<AtsWebhookEnvelope | null> {
  const metadata = { entityName: event.entityName, eventType: event.eventType, eventId: event.eventId };
  const occurredAt = coerceDate(event.timestamp);
  const entity = event.entityName.toLowerCase();

  if (entity === "placement") {
    const placement = event.placement ?? (await deps.lookupPlacement?.(String(event.entityId))) ?? null;

    if (!placement) return null;

    const mapped = mapBullhornPlacement(placement);
    return {
      type: "outcome",
      payload: { ...mapPlacementOutcome(placement, mapped), metadata },
    };
  }

  if (entity === "jobsubmission" || entity === "candidate") {
    const envelope: AtsWebhookEnvelope = {
      type: "stage_change",
      payload: {
        jobId: String(event.jobId ?? event.entityId),
        candidateId: String(event.candidateId ?? event.entityId),
        fromStage: event.fromStage ?? null,
        toStage: event.status ?? event.eventType,
        changedAt: occurredAt,
        metadata,
      },
    };

    return envelope;
  }

  return null;
}

export class BullhornAtsAdapter implements AtsAdapter {
  readonly provider = "bullhorn";

  constructor(private readonly client: BullhornAtsClient, private readonly store: AtsEventStore) {}

  async ingestJob(jobId: string): Promise<AtsJob> {
    const raw = await this.client.fetchJob(jobId);
    const mapped = mapBullhornJob(raw);
    return toAtsJob(raw, mapped);
  }

  async ingestCandidate(jobId: string, candidateId: string): Promise<CandidateIngestResult> {
    const [job, candidate] = await Promise.all([this.ingestJob(jobId), this.client.fetchCandidate(candidateId)]);

    const mapped = mapBullhornCandidate(candidate);

    return {
      job,
      candidate: toAtsCandidate(candidate, mapped),
      receivedAt: new Date(),
    };
  }

  async ingestShortlist(jobId: string): Promise<{ job: AtsJob; candidates: AtsCandidateSummary[]; receivedAt: Date }> {
    const job = await this.ingestJob(jobId);
    const shortlist: AtsCandidateSummary[] = [];

    const rawCandidates =
      (await this.client.fetchShortlistCandidates?.(jobId)) ??
      (await this.client.fetchCandidate(jobId).then((single) => [single]).catch(() => []));

    for (const candidate of rawCandidates) {
      shortlist.push(toAtsCandidate(candidate, mapBullhornCandidate(candidate)));
    }

    return { job, candidates: shortlist, receivedAt: new Date() };
  }

  async pushShortlist(payload: ShortlistPushPayload): Promise<ShortlistPushResult> {
    const ids = this.client.pushShortlist
      ? await this.client.pushShortlist(payload.jobId, payload.candidates, payload.note)
      : payload.candidates.map((candidate, index) => `${payload.jobId}-${index + 1}-${candidate.id}`);

    const result: ShortlistPushResult = {
      jobId: payload.jobId,
      pushed: ids.length,
      externalCandidateIds: ids,
      requestedAt: new Date(),
    };

    await this.store.recordShortlistPush(result);
    return result;
  }

  async receiveOutcome(envelope: AtsWebhookEnvelope): Promise<OutcomeReceipt> {
    if (envelope.type === "stage_change") {
      const event: StageChangeEvent = {
        ...envelope.payload,
        metadata: { provider: this.provider, ...(envelope.payload.metadata ?? {}) },
      };
      await this.store.recordStageChange(event);
      return { acknowledged: true };
    }

    if (envelope.type === "outcome") {
      const event: OutcomeEvent = {
        ...envelope.payload,
        metadata: { provider: this.provider, ...(envelope.payload.metadata ?? {}) },
      };
      await this.store.recordOutcome(event);
      return { acknowledged: true };
    }

    return { acknowledged: false, reason: "Unsupported webhook type" };
  }
}
