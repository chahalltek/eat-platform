/// <reference types="vitest/globals" />

import { POST } from './route';
import { recordCoverageReport } from '@/lib/metrics/quality';

vi.mock('@/lib/metrics/quality', () => ({
  recordCoverageReport: vi.fn(),
}));

describe('POST /api/admin/quality/coverage', () => {
  const originalToken = process.env.QUALITY_INGEST_TOKEN;

  afterEach(() => {
    vi.clearAllMocks();
    process.env.QUALITY_INGEST_TOKEN = originalToken;
  });

  it('rejects requests when the ingest token does not match', async () => {
    process.env.QUALITY_INGEST_TOKEN = 'secret-token';

    const response = await POST(
      new Request('http://localhost/api/admin/quality/coverage', {
        method: 'POST',
        body: JSON.stringify({ coveragePercent: 78.5 }),
      }),
    );

    expect(response.status).toBe(401);
    expect(recordCoverageReport).not.toHaveBeenCalled();
  });

  it('persists coverage reports when authorized', async () => {
    process.env.QUALITY_INGEST_TOKEN = 'secret-token';

    vi.mocked(recordCoverageReport).mockResolvedValue({
      id: 'coverage-123',
      branch: 'main',
      commitSha: 'abc123',
      coveragePercent: 78.5,
      createdAt: new Date('2025-02-10T10:00:00.000Z'),
    } as never);

    const response = await POST(
      new Request('http://localhost/api/admin/quality/coverage', {
        method: 'POST',
        body: JSON.stringify({ coveragePercent: 78.5, branch: 'main', commitSha: 'abc123' }),
        headers: { Authorization: 'Bearer secret-token' },
      }),
    );

    const payload = await response.json();

    expect(recordCoverageReport).toHaveBeenCalledWith({
      coveragePercent: 78.5,
      branch: 'main',
      commitSha: 'abc123',
    });
    expect(response.status).toBe(201);
    expect(payload).toEqual({
      id: 'coverage-123',
      branch: 'main',
      commitSha: 'abc123',
      coveragePercent: 78.5,
      createdAt: '2025-02-10T10:00:00.000Z',
    });
  });

  it('validates the payload', async () => {
    process.env.QUALITY_INGEST_TOKEN = '';

    const response = await POST(
      new Request('http://localhost/api/admin/quality/coverage', {
        method: 'POST',
        body: JSON.stringify({ coveragePercent: 'not-a-number' }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'coveragePercent must be provided as a number' });
    expect(recordCoverageReport).not.toHaveBeenCalled();
  });
});
