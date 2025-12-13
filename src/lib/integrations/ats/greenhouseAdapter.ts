import type {
  AtsAdapter,
  AtsCandidateSummary,
  AtsEventStore,
  AtsJob,
  CandidateIngestResult,
  AtsWebhookEnvelope,
  OutcomeReceipt,
  ShortlistIngestResult,
  ShortlistPushPayload,
  ShortlistPushResult,
  StageChangeEvent,
  OutcomeEvent,
} from './types';

export interface GreenhouseJob {
  id: string | number;
  title: string;
  status: string;
  location?: { name?: string } | null;
  updated_at?: string;
  opened_at?: string;
  departments?: { name?: string }[];
  absolute_url?: string;
}

export interface GreenhouseApplication {
  id: string | number;
  job_id: string | number;
  applied_at?: string;
  prospect?: boolean;
  stage?: { name?: string } | null;
  source?: { public_name?: string } | null;
  candidate: {
    id: string | number;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    resume_url?: string;
  };
}

export interface GreenhouseWebhookStageChange {
  action: 'stage_change';
  application_id: string | number;
  job_id: string | number;
  candidate_id: string | number;
  from_stage?: string | null;
  to_stage: string;
  happened_at: string;
}

export interface GreenhouseWebhookOutcome {
  action: 'hire' | 'reject' | 'offer' | 'advance';
  application_id: string | number;
  job_id: string | number;
  candidate_id: string | number;
  outcome: string;
  happened_at: string;
}

export interface GreenhouseClient {
  fetchJob(jobId: string): Promise<GreenhouseJob>;
  fetchApplications(jobId: string): Promise<GreenhouseApplication[]>;
  pushProspects(jobId: string, candidates: AtsCandidateSummary[], note?: string): Promise<string[]>;
}

export class GreenhouseAdapter implements AtsAdapter {
  readonly provider = 'greenhouse';
  constructor(private readonly client: GreenhouseClient, private readonly store: AtsEventStore) {}

  async ingestJob(jobId: string): Promise<AtsJob> {
    const raw = await this.client.fetchJob(jobId);
    return mapJob(raw);
  }

  async ingestCandidate(jobId: string, candidateId: string): Promise<CandidateIngestResult> {
    const [job, applications] = await Promise.all([
      this.ingestJob(jobId),
      this.client.fetchApplications(jobId),
    ]);

    const application = applications.find(
      (candidateApplication) =>
        String(candidateApplication.candidate.id) === candidateId ||
        String(candidateApplication.id) === candidateId,
    );

    if (!application) {
      throw new Error(`Candidate ${candidateId} not found for job ${jobId}`);
    }

    return {
      job,
      candidate: mapCandidate(application),
      receivedAt: new Date(),
    };
  }

  async ingestShortlist(jobId: string): Promise<ShortlistIngestResult> {
    const [job, applications] = await Promise.all([
      this.ingestJob(jobId),
      this.client.fetchApplications(jobId),
    ]);

    const candidates = applications.map(mapCandidate);

    return {
      job,
      candidates,
      receivedAt: new Date(),
    };
  }

  async pushShortlist(payload: ShortlistPushPayload): Promise<ShortlistPushResult> {
    const externalIds = await this.client.pushProspects(payload.jobId, payload.candidates, payload.note);

    const result: ShortlistPushResult = {
      jobId: payload.jobId,
      pushed: externalIds.length,
      externalCandidateIds: externalIds,
      requestedAt: new Date(),
    };

    await this.store.recordShortlistPush(result);
    return result;
  }

  async receiveOutcome(envelope: AtsWebhookEnvelope): Promise<OutcomeReceipt> {
    if (envelope.type === 'stage_change') {
      const event: StageChangeEvent = {
        ...envelope.payload,
        metadata: { provider: this.provider, ...(envelope.payload.metadata ?? {}) },
      };
      await this.store.recordStageChange(event);
      return { acknowledged: true };
    }

    if (envelope.type === 'outcome') {
      const event: OutcomeEvent = {
        ...envelope.payload,
        metadata: { provider: this.provider, ...(envelope.payload.metadata ?? {}) },
      };
      await this.store.recordOutcome(event);
      return { acknowledged: true };
    }

    return { acknowledged: false, reason: 'Unsupported webhook type' };
  }
}

export function mapJob(job: GreenhouseJob): AtsJob {
  return {
    id: String(job.id),
    title: job.title,
    location: job.location?.name ?? null,
    department: job.departments?.[0]?.name ?? null,
    status: job.status,
    openedAt: parseDate(job.opened_at ?? job.updated_at),
    externalUrl: job.absolute_url ?? null,
  };
}

export function mapCandidate(application: GreenhouseApplication): AtsCandidateSummary {
  const fullName = `${application.candidate.first_name} ${application.candidate.last_name}`.trim();

  return {
    id: String(application.candidate.id),
    fullName,
    email: application.candidate.email ?? null,
    phone: application.candidate.phone ?? null,
    resumeUrl: application.candidate.resume_url ?? null,
    appliedAt: parseDate(application.applied_at),
    stage: application.stage?.name ?? null,
    source: application.source?.public_name ?? null,
  };
}

export function mapStageChange(payload: GreenhouseWebhookStageChange): AtsWebhookEnvelope {
  return {
    type: 'stage_change',
    payload: {
      jobId: String(payload.job_id),
      candidateId: String(payload.candidate_id),
      fromStage: payload.from_stage ?? null,
      toStage: payload.to_stage,
      changedAt: new Date(payload.happened_at),
    },
  };
}

export function mapOutcome(payload: GreenhouseWebhookOutcome): AtsWebhookEnvelope {
  return {
    type: 'outcome',
    payload: {
      jobId: String(payload.job_id),
      candidateId: String(payload.candidate_id),
      outcome: payload.outcome,
      decidedAt: new Date(payload.happened_at),
    },
  };
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
