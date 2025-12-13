export type BenchmarkRelease = {
  id: string;
  title: string;
  status: 'draft' | 'published';
  publishedAt?: Date;
  metricKeys: string[];
};

const PUBLISHED_BENCHMARK_RELEASES: BenchmarkRelease[] = [
  {
    id: '2026-Q1',
    title: 'ETE Benchmark 2026-Q1',
    status: 'published',
    publishedAt: new Date('2026-02-15T00:00:00Z'),
    metricKeys: ['scarcity-index', 'time-to-fill', 'market-heatmap'],
  },
  {
    id: '2025-Q4',
    title: 'ETE Benchmark 2025-Q4',
    status: 'published',
    publishedAt: new Date('2025-11-15T00:00:00Z'),
    metricKeys: ['scarcity-index', 'time-to-fill'],
  },
];

export function listPublishedBenchmarkReleases(): BenchmarkRelease[] {
  return PUBLISHED_BENCHMARK_RELEASES.filter((release) => release.status === 'published');
}

export function getPublishedBenchmarkRelease(releaseId: string): BenchmarkRelease | undefined {
  return listPublishedBenchmarkReleases().find((release) => release.id === releaseId);
}
