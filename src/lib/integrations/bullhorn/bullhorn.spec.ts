import { describe, expect, it } from 'vitest';
import { BullhornClient } from './client';
import { defaultMappingConfig, mapBullhornCandidate, mapBullhornJob, mapBullhornPlacement } from './mappings';
import { MockBullhornApi } from './mockApi';
import { InMemorySyncStore, syncBullhorn } from './sync';
import type { BullhornCandidate, BullhornJob, BullhornPlacement } from './types';

describe('Bullhorn connector', () => {
  const jobs: BullhornJob[] = [
    {
      id: 101,
      title: 'Senior Product Manager',
      employmentType: 'Full-Time',
      address: { city: 'Austin', state: 'TX', country: 'USA' },
      description: 'Owns product strategy',
      dateAdded: '2024-12-01T12:00:00Z',
      customText10: 'Remote friendly',
      clientCorporation: { name: 'Acme Corp' },
    },
  ];

  const candidates: BullhornCandidate[] = [
    {
      id: 301,
      firstName: 'Jordan',
      lastName: 'Smith',
      email: 'jordan@example.com',
      phone: '+15125551212',
      city: 'Austin',
      state: 'TX',
      country: 'USA',
      dateAdded: 1704067200000,
      occupation: 'Product Manager',
      source: 'Referral',
    },
  ];

  const placements: BullhornPlacement[] = [
    {
      id: 901,
      jobOrder: jobs[0],
      candidate: candidates[0],
      startDate: '2025-01-15',
      endDate: '2025-07-15',
      status: 'Submitted',
    },
  ];

  it('supports OAuth handshake and mock API reads', async () => {
    const mockApi = new MockBullhornApi({ jobs, candidates, placements });

    const client = new BullhornClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://example.com/callback',
      baseUrl: 'https://mock.bullhorn.local',
      authBaseUrl: 'https://mock.bullhorn.local',
      httpClient: mockApi.handler,
      testMode: true,
    });

    expect(client.buildAuthUrl()).toContain('mode=test');

    await client.exchangeCodeForToken('abc123');

    const [fetchedJobs, fetchedCandidates, fetchedPlacements] = await Promise.all([
      client.getJobs(),
      client.getCandidates(),
      client.getPlacements(),
    ]);

    expect(fetchedJobs).toHaveLength(1);
    expect(fetchedJobs[0]?.id).toBe('101');
    expect(fetchedCandidates[0]?.fullName).toBe('Jordan Smith');
    expect(fetchedPlacements[0]?.candidateId).toBe('301');
  });

  it('maps Bullhorn payloads using the mapping layer', () => {
    const mappedJob = mapBullhornJob(jobs[0]);
    expect(mappedJob).toMatchObject({
      id: '101',
      title: 'Senior Product Manager',
      employmentType: 'Full-Time',
      location: 'Austin, TX, USA',
      remote: true,
      company: 'Acme Corp',
    });

    const mappedCandidate = mapBullhornCandidate(candidates[0]);
    expect(mappedCandidate).toMatchObject({
      id: '301',
      fullName: 'Jordan Smith',
      location: 'Austin, TX, USA',
      title: 'Product Manager',
      source: 'Referral',
    });

    const mappedPlacement = mapBullhornPlacement(placements[0]);
    expect(mappedPlacement).toMatchObject({
      id: '901',
      jobId: '101',
      candidateId: '301',
      status: 'Submitted',
    });
  });

  it('keeps sync idempotent by upserting records', async () => {
    const mockApi = new MockBullhornApi({ jobs, candidates, placements });

    const client = new BullhornClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://example.com/callback',
      baseUrl: 'https://mock.bullhorn.local',
      authBaseUrl: 'https://mock.bullhorn.local',
      httpClient: mockApi.handler,
    });

    await client.exchangeCodeForToken('abc123');

    const store = new InMemorySyncStore();

    const executeSync = () =>
      syncBullhorn({
        fetchJobs: () => client.getJobs(),
        fetchCandidates: () => client.getCandidates(),
        fetchPlacements: () => client.getPlacements(),
        mapping: defaultMappingConfig,
        store,
      });

    const first = await executeSync();
    const second = await executeSync();

    expect(first).toMatchObject({ jobsSynced: 1, candidatesSynced: 1, placementsSynced: 1 });
    expect(second).toMatchObject({ jobsSynced: 1, candidatesSynced: 1, placementsSynced: 1 });

    expect(store.jobs.size).toBe(1);
    expect(store.candidates.size).toBe(1);
    expect(store.placements.size).toBe(1);
  });
});
