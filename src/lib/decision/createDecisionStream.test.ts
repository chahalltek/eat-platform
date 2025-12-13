import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockedDecisionStreamClient = {
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

vi.mock('../prisma', () => {
  const decisionStream: MockedDecisionStreamClient = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };

  return {
    prisma: {
      decisionStream,
    },
  };
});

import { prisma } from '../prisma';
import { createDecisionStream } from './createDecisionStream';

describe('createDecisionStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an existing active stream for the recruiter and job', async () => {
    const existingStream = { id: 'stream-1' };
    const decisionStreamClient = prisma.decisionStream as unknown as MockedDecisionStreamClient;
    decisionStreamClient.findFirst.mockResolvedValue(existingStream);

    const result = await createDecisionStream({ jobId: 'job-123', createdBy: 'user-123' });

    expect(prisma.decisionStream.findFirst).toHaveBeenCalledWith({
      where: { jobId: 'job-123', createdBy: 'user-123', status: 'active' },
    });
    expect(prisma.decisionStream.create).not.toHaveBeenCalled();
    expect(result).toBe(existingStream);
  });

  it('creates a new active stream when none exist', async () => {
    const decisionStreamClient = prisma.decisionStream as unknown as MockedDecisionStreamClient;
    decisionStreamClient.findFirst.mockResolvedValue(null);
    const createdStream = { id: 'stream-2' };
    decisionStreamClient.create.mockResolvedValue(createdStream);

    const result = await createDecisionStream({ jobId: 'job-456', createdBy: 'user-456' });

    expect(prisma.decisionStream.create).toHaveBeenCalledWith({
      data: { jobId: 'job-456', createdBy: 'user-456', status: 'active' },
    });
    expect(result).toBe(createdStream);
  });
});
