import type { AtsCandidateSummary, ShortlistPushResult } from './types';
import type {
  GreenhouseApplication,
  GreenhouseClient,
  GreenhouseJob,
} from './greenhouseAdapter';

interface MockData {
  jobs: GreenhouseJob[];
  applications: GreenhouseApplication[];
}

export class MockGreenhouseClient implements GreenhouseClient {
  constructor(private readonly data: MockData) {}

  async fetchJob(jobId: string): Promise<GreenhouseJob> {
    const match = this.data.jobs.find((job) => String(job.id) === jobId);
    if (!match) {
      throw new Error(`Job ${jobId} not found`);
    }
    return match;
  }

  async fetchApplications(jobId: string): Promise<GreenhouseApplication[]> {
    return this.data.applications.filter((application) => String(application.job_id) === jobId);
  }

  async pushProspects(jobId: string, candidates: AtsCandidateSummary[]): Promise<string[]> {
    // Simulate creation by appending synthetic ids
    return candidates.map((candidate, index) => `${jobId}-${index + 1}-${candidate.id}`);
  }
}

export class RecordingGreenhouseClient extends MockGreenhouseClient {
  readonly pushes: ShortlistPushResult[] = [];

  constructor(data: MockData) {
    super(data);
  }

  override async pushProspects(jobId: string, candidates: AtsCandidateSummary[]): Promise<string[]> {
    const ids = await super.pushProspects(jobId, candidates);
    this.pushes.push({
      jobId,
      pushed: candidates.length,
      externalCandidateIds: ids,
      requestedAt: new Date(),
    });
    return ids;
  }
}
