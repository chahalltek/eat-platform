import { describe, expect, it } from 'vitest';
import { GreenhouseAdapter, mapCandidate, mapJob, mapOutcome, mapStageChange } from './greenhouseAdapter';
import { InMemoryAtsEventStore } from './types';
import { MockGreenhouseClient, RecordingGreenhouseClient } from './greenhouseMockClient';

const job = {
  id: 42,
  title: 'Staff Engineer',
  status: 'open',
  location: { name: 'Remote - US' },
  opened_at: '2025-01-01T12:00:00Z',
  departments: [{ name: 'Engineering' }],
  absolute_url: 'https://boards.greenhouse.io/jobs/42',
};

const applications = [
  {
    id: 1001,
    job_id: 42,
    applied_at: '2025-01-05T09:00:00Z',
    stage: { name: 'Phone Screen' },
    source: { public_name: 'Referral' },
    candidate: {
      id: 2001,
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone: '+1234567890',
      resume_url: 'https://example.com/resume.pdf',
    },
  },
  {
    id: 1002,
    job_id: 42,
    applied_at: '2025-01-06T15:00:00Z',
    stage: { name: 'Technical Interview' },
    source: { public_name: 'LinkedIn' },
    candidate: {
      id: 2002,
      first_name: 'Grace',
      last_name: 'Hopper',
      email: 'grace@example.com',
      phone: '+1987654321',
    },
  },
];

describe('GreenhouseAdapter', () => {
  it('ingests jobs and shortlists through the adapter contract', async () => {
    const client = new MockGreenhouseClient({ jobs: [job], applications });
    const store = new InMemoryAtsEventStore();
    const adapter = new GreenhouseAdapter(client, store);

    const mappedJob = await adapter.ingestJob('42');
    expect(mappedJob).toMatchObject({
      id: '42',
      title: 'Staff Engineer',
      department: 'Engineering',
      location: 'Remote - US',
      status: 'open',
    });

    const shortlist = await adapter.ingestShortlist('42');
    expect(shortlist.job.id).toBe('42');
    expect(shortlist.candidates).toHaveLength(2);
    expect(shortlist.candidates[0]).toMatchObject({
      id: '2001',
      fullName: 'Ada Lovelace',
      stage: 'Phone Screen',
      source: 'Referral',
    });
  });

  it('pushes shortlists and records provider ids', async () => {
    const client = new RecordingGreenhouseClient({ jobs: [job], applications });
    const store = new InMemoryAtsEventStore();
    const adapter = new GreenhouseAdapter(client, store);

    const shortlist = await adapter.ingestShortlist('42');
    const pushResult = await adapter.pushShortlist({ jobId: '42', candidates: shortlist.candidates });

    expect(pushResult.externalCandidateIds).toHaveLength(2);
    expect(store.shortlistPushes).toHaveLength(1);
    expect(client.pushes[0]?.pushed).toBe(2);
  });

  it('normalizes webhook payloads for stage changes and outcomes', async () => {
    const client = new MockGreenhouseClient({ jobs: [job], applications });
    const store = new InMemoryAtsEventStore();
    const adapter = new GreenhouseAdapter(client, store);

    const stageChangeEnvelope = mapStageChange({
      action: 'stage_change',
      application_id: 1001,
      job_id: 42,
      candidate_id: 2001,
      from_stage: 'Phone Screen',
      to_stage: 'Onsite',
      happened_at: '2025-01-10T10:00:00Z',
    });

    const outcomeEnvelope = mapOutcome({
      action: 'hire',
      application_id: 1001,
      job_id: 42,
      candidate_id: 2001,
      outcome: 'Hired',
      happened_at: '2025-01-15T15:00:00Z',
    });

    await adapter.receiveOutcome(stageChangeEnvelope);
    await adapter.receiveOutcome(outcomeEnvelope);

    expect(store.stageChanges[0]).toMatchObject({
      jobId: '42',
      candidateId: '2001',
      fromStage: 'Phone Screen',
      toStage: 'Onsite',
    });

    expect(store.outcomes[0]).toMatchObject({
      jobId: '42',
      candidateId: '2001',
      outcome: 'Hired',
    });
  });
});

describe('mapping helpers', () => {
  it('maps jobs and candidates defensively', () => {
    const mappedJob = mapJob(job);
    const mappedCandidate = mapCandidate(applications[0]);

    expect(mappedJob.openedAt).toBeInstanceOf(Date);
    expect(mappedCandidate).toMatchObject({
      id: '2001',
      fullName: 'Ada Lovelace',
      stage: 'Phone Screen',
      source: 'Referral',
    });
  });
});
