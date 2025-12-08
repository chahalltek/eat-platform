import { mapBullhornCandidate, mapBullhornJob, mapBullhornPlacement } from './mappings';
import type {
  BullhornJob,
  BullhornCandidate,
  BullhornPlacement,
  SyncSummary,
  SyncStore,
  BullhornMappingConfig,
} from './types';

export interface SyncDependencies {
  fetchJobs: () => Promise<BullhornJob[]>;
  fetchCandidates: () => Promise<BullhornCandidate[]>;
  fetchPlacements: () => Promise<BullhornPlacement[]>;
  mapping: BullhornMappingConfig;
  store: SyncStore;
}

export async function syncBullhorn({
  fetchJobs,
  fetchCandidates,
  fetchPlacements,
  mapping,
  store,
}: SyncDependencies): Promise<SyncSummary> {
  const [jobs, candidates, placements] = await Promise.all([
    fetchJobs(),
    fetchCandidates(),
    fetchPlacements(),
  ]);

  const mappedJobs = jobs.map((job) => mapBullhornJob(job, mapping.job));
  const mappedCandidates = candidates.map((candidate) =>
    mapBullhornCandidate(candidate, mapping.candidate),
  );
  const mappedPlacements = placements.map((placement) =>
    mapBullhornPlacement(placement, mapping.placement),
  );

  await Promise.all([
    store.upsertJobs(mappedJobs),
    store.upsertCandidates(mappedCandidates),
    store.upsertPlacements(mappedPlacements),
  ]);

  return {
    jobsSynced: mappedJobs.length,
    candidatesSynced: mappedCandidates.length,
    placementsSynced: mappedPlacements.length,
  };
}

export class InMemorySyncStore implements SyncStore {
  readonly jobs = new Map<string, ReturnType<typeof mapBullhornJob>>();
  readonly candidates = new Map<string, ReturnType<typeof mapBullhornCandidate>>();
  readonly placements = new Map<string, ReturnType<typeof mapBullhornPlacement>>();

  async upsertJobs(jobs: ReturnType<typeof mapBullhornJob>[]): Promise<void> {
    for (const job of jobs) {
      this.jobs.set(job.id, job);
    }
  }

  async upsertCandidates(
    candidates: ReturnType<typeof mapBullhornCandidate>[],
  ): Promise<void> {
    for (const candidate of candidates) {
      this.candidates.set(candidate.id, candidate);
    }
  }

  async upsertPlacements(
    placements: ReturnType<typeof mapBullhornPlacement>[],
  ): Promise<void> {
    for (const placement of placements) {
      this.placements.set(placement.id, placement);
    }
  }
}
