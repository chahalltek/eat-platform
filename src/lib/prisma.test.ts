import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';

import { isPrismaUnavailableError } from './prisma';

describe('isPrismaUnavailableError', () => {
  it('returns true for connection failures', () => {
    const error = new Prisma.PrismaClientKnownRequestError('message', {
      code: 'P1001',
      clientVersion: '5.19.0',
    });

    expect(isPrismaUnavailableError(error)).toBe(true);
  });

  it('returns false for other Prisma errors', () => {
    const error = new Prisma.PrismaClientKnownRequestError('message', {
      code: 'P2001',
      clientVersion: '5.19.0',
    });

    expect(isPrismaUnavailableError(error)).toBe(false);
  });

  it('returns false for non-Prisma errors', () => {
    expect(isPrismaUnavailableError(new Error('something else'))).toBe(false);
  });
});
