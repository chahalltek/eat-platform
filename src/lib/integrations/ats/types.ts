export type AtsProvider = 'greenhouse' | 'lever' | 'workday' | string;

export interface AtsJob {
  id: string;
  title: string;
  location: string | null;
  department: string | null;
  status: string;
  openedAt: Date | null;
  externalUrl?: string | null;
}

export interface AtsCandidateSummary {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  resumeUrl?: string | null;
  appliedAt: Date | null;
  stage: string | null;
  source?: string | null;
}

export interface ShortlistIngestResult {
  job: AtsJob;
  candidates: AtsCandidateSummary[];
  receivedAt: Date;
}

export interface ShortlistPushPayload {
  jobId: string;
  candidates: AtsCandidateSummary[];
  note?: string;
}

export interface ShortlistPushResult {
  jobId: string;
  pushed: number;
  externalCandidateIds: string[];
  requestedAt: Date;
}

export interface StageChangeEvent {
  jobId: string;
  candidateId: string;
  fromStage: string | null;
  toStage: string;
  changedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface OutcomeEvent {
  jobId: string;
  candidateId: string;
  outcome: string;
  decidedAt: Date;
  metadata?: Record<string, unknown>;
}

export type AtsWebhookEnvelope =
  | { type: 'stage_change'; payload: StageChangeEvent }
  | { type: 'outcome'; payload: OutcomeEvent };

export interface OutcomeReceipt {
  acknowledged: boolean;
  reason?: string;
}

export interface AtsAdapter {
  provider: AtsProvider;
  ingestJob(jobId: string): Promise<AtsJob>;
  ingestShortlist(jobId: string): Promise<ShortlistIngestResult>;
  pushShortlist(payload: ShortlistPushPayload): Promise<ShortlistPushResult>;
  receiveOutcome(envelope: AtsWebhookEnvelope): Promise<OutcomeReceipt>;
}

export interface AtsEventStore {
  recordStageChange(event: StageChangeEvent): Promise<void>;
  recordOutcome(event: OutcomeEvent): Promise<void>;
  recordShortlistPush(result: ShortlistPushResult): Promise<void>;
}

export class InMemoryAtsEventStore implements AtsEventStore {
  readonly stageChanges: StageChangeEvent[] = [];
  readonly outcomes: OutcomeEvent[] = [];
  readonly shortlistPushes: ShortlistPushResult[] = [];

  async recordStageChange(event: StageChangeEvent): Promise<void> {
    this.stageChanges.push(event);
  }

  async recordOutcome(event: OutcomeEvent): Promise<void> {
    this.outcomes.push(event);
  }

  async recordShortlistPush(result: ShortlistPushResult): Promise<void> {
    this.shortlistPushes.push(result);
  }
}
