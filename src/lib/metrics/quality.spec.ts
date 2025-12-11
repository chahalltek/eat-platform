/// <reference types="vitest/globals" />

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AgentRunStatus } from '@prisma/client';

import { getQualityMetrics } from './quality';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentRunLog: {
      findMany: vi.fn(),
    },
    coverageReport: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('getQualityMetrics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-15T12:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('summarizes coverage, run volume, and failure rates', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-'));
    const coverageSummaryPath = path.join(tempDir, 'coverage-summary.json');
    fs.writeFileSync(
      coverageSummaryPath,
      JSON.stringify({
        total: { lines: { total: 10, covered: 8 } },
        'src/components/table/EATTable.tsx': { lines: { total: 4, covered: 3 } },
      }),
      'utf8',
    );

    const mockAgentRuns = [
      { startedAt: new Date('2025-02-15T02:00:00.000Z'), status: AgentRunStatus.SUCCESS, agentName: 'ETE-TS.RINA' },
      { startedAt: new Date('2025-02-14T08:00:00.000Z'), status: AgentRunStatus.FAILED, agentName: 'ETE-TS.RINA' },
      { startedAt: new Date('2025-02-13T10:00:00.000Z'), status: AgentRunStatus.FAILED, agentName: 'ETE-TS.RUA' },
      { startedAt: new Date('2025-02-12T09:00:00.000Z'), status: AgentRunStatus.SUCCESS, agentName: 'ETE-TS.RUA' },
    ];

    const mockCoverageHistory = [
      { coveragePercent: 81.25, createdAt: new Date('2025-02-12T12:00:00.000Z') },
      { coveragePercent: 82.44, createdAt: new Date('2025-02-14T23:00:00.000Z') },
    ];

    const mockLatestCoverage = {
      id: 'coverage-1',
      branch: 'main',
      commitSha: 'abc123',
      coveragePercent: 82.44,
      createdAt: new Date('2025-02-14T23:00:00.000Z'),
    };

    const prisma = await import('@/lib/prisma');
    vi.mocked(prisma.prisma.agentRunLog.findMany).mockResolvedValue(mockAgentRuns);
    vi.mocked(prisma.prisma.coverageReport.findFirst).mockResolvedValue(mockLatestCoverage as never);
    vi.mocked(prisma.prisma.coverageReport.findMany).mockResolvedValue(mockCoverageHistory as never);

    const metrics = await getQualityMetrics(4, { coverageSummaryPath });

    expect(metrics.coverage.latestPercent).toBe(82.4);
    expect(metrics.coverage.lastUpdated).toBe('2025-02-14T23:00:00.000Z');

    const coverageByDate = Object.fromEntries(metrics.coverage.history.map((bucket) => [bucket.date, bucket.percent]));
    expect(coverageByDate['2025-02-12']).toBe(81.3);
    expect(coverageByDate['2025-02-14']).toBe(82.4);

    const runsByDate = Object.fromEntries(metrics.runs.perDay.map((bucket) => [bucket.date, bucket.count]));
    expect(runsByDate['2025-02-15']).toBe(1);
    expect(runsByDate['2025-02-14']).toBe(1);
    expect(runsByDate['2025-02-13']).toBe(1);
    expect(runsByDate['2025-02-12']).toBe(1);

    expect(metrics.errors.total).toBe(2);
    expect(metrics.errors.failureRate).toBe(50);

    expect(metrics.errors.byAgent).toEqual([
      { agentName: 'ETE-TS.RINA', failureRate: 50, failedRuns: 1, totalRuns: 2 },
      { agentName: 'ETE-TS.RUA', failureRate: 50, failedRuns: 1, totalRuns: 2 },
    ]);

    expect(metrics.coverage.sections).toEqual([
      { label: 'Tables', path: 'src/components/table', percent: 75 },
    ]);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
