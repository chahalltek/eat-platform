import { describe, expect, it, vi } from 'vitest';

import { runPipelineStep } from './pipelineRunner';

const { mockCreate, mockUpdate, mockPrisma } = vi.hoisted(() => {
  const mockCreate = vi.fn(async ({ data }) => ({ id: 'run-123', ...data }));
  const mockUpdate = vi.fn(async ({ data, where }) => ({ id: where.id, ...data }));

  return {
    mockCreate,
    mockUpdate,
    mockPrisma: {
      agentRun: {
        create: mockCreate,
        update: mockUpdate,
      },
    },
  };
});

describe('pipelineRunner', () => {
  it('records successful pipeline runs with output details', async () => {
    const result = await runPipelineStep(
      mockPrisma,
      {
        agentName: 'MATCH',
        tenantId: 'tenant-1',
        requestedBy: 'ui',
        jobId: 'job-1',
        mode: 'auto',
        promptMeta: { version: 'v1' },
        input: {
          jobId: 'job-1',
          candidatesInput: [{ id: 'cand-1' }],
          promptContext: { scenario: 'A' },
          mode: 'auto',
        },
      },
      async () => ({
        results: { matches: ['a', 'b'] },
        matchesReturned: 2,
        shortlistCount: 1,
        outreachCount: 0,
        candidateCount: 3,
        outreachInteractions: [{ id: 'outreach-1' }],
        mode: 'auto',
        tenantId: 'tenant-1',
        tokenUsage: { promptTokens: 10, completionTokens: 5 },
      }),
    );

    expect(result.status).toBe('success');
    expect(result.runId).toBe('run-123');

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentName: 'MATCH',
        tenantId: 'tenant-1',
        requestedBy: 'ui',
        jobId: 'job-1',
        promptMeta: { version: 'v1' },
        input: {
          jobId: 'job-1',
          candidatesInput: [{ id: 'cand-1' }],
          promptContext: { scenario: 'A' },
          mode: 'auto',
        },
        status: 'running',
      }),
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'run-123' },
      data: expect.objectContaining({
        status: 'success',
        output: {
          results: { matches: ['a', 'b'] },
          matchesReturned: 2,
          shortlistCount: 1,
          outreachCount: 0,
          candidateCount: 3,
          outreachInteractions: [{ id: 'outreach-1' }],
          mode: 'auto',
          tenantId: 'tenant-1',
          tokens: { promptTokens: 10, completionTokens: 5 },
        },
      }),
    });
  });

  it('records skipped steps with reasons', async () => {
    const result = await runPipelineStep(
      mockPrisma,
      {
        agentName: 'SHORTLIST',
        tenantId: 'tenant-1',
        jobId: 'job-2',
        skipReason: 'No candidates to process',
      },
      async () => ({ results: { message: 'unused' } }),
    );

    expect(result.status).toBe('skipped');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'run-123' },
      data: expect.objectContaining({
        status: 'skipped',
        output: {
          skipReason: 'No candidates to process',
          mode: null,
          tenantId: 'tenant-1',
        },
      }),
    });
  });

  it('records failures with error details', async () => {
    const failingHandler = vi.fn(async () => {
      throw new Error('pipeline failed');
    });

    await expect(
      runPipelineStep(
        mockPrisma,
        {
          agentName: 'OUTREACH',
          tenantId: 'tenant-1',
          mode: 'manual',
          input: { mode: 'manual' },
        },
        failingHandler,
      ),
    ).rejects.toThrow('pipeline failed');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'run-123' },
      data: expect.objectContaining({
        status: 'failed',
        output: expect.objectContaining({
          error: 'pipeline failed',
          mode: 'manual',
          tenantId: 'tenant-1',
        }),
      }),
    });
  });
});
