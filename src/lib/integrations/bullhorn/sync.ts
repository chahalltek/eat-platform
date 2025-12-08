import type { MappedJob, MappedCandidate, MappedPlacement, SyncSummary, SyncStore } from './types';

export interface SyncDependencies {
  fetchJobs: () => Promise<MappedJob[]>;
  fetchCandidates: () => Promise<MappedCandidate[]>;
  fetchPlacements: () => Promise<MappedPlacement[]>;
  store: SyncStore;
}

export async function syncBullhorn({
  fetchJobs,
  fetchCandidates,
  fetchPlacements,
  store,
}: SyncDependencies): Promise<SyncSummary> {
  const [jobs, candidates, placements] = await Promise.all([
    fetchJobs(),
    fetchCandidates(),
    fetchPlacements(),
  ]);

  await Promise.all([
    store.upsertJobs(jobs),
    store.upsertCandidates(candidates),
    store.upsertPlacements(placements),
  ]);

  return {
    jobsSynced: jobs.length,
    candidatesSynced: candidates.length,
    placementsSynced: placements.length,
  };
}

export class InMemorySyncStore implements SyncStore {
  readonly jobs = new Map<string, MappedJob>();
  readonly candidates = new Map<string, MappedCandidate>();
  readonly placements = new Map<string, MappedPlacement>();

  async upsertJobs(jobs: MappedJob[]): Promise<void> {
    for (const job of jobs) {
      this.jobs.set(job.id, job);
    }
  }

  async upsertCandidates(candidates: MappedCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      this.candidates.set(candidate.id, candidate);
    }
  }

  async upsertPlacements(placements: MappedPlacement[]): Promise<void> {
    for (const placement of placements) {
      this.placements.set(placement.id, placement);
    }
  }
}
