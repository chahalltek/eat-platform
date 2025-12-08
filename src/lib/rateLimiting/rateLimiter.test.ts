import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RateLimiter, RateLimitError, type RateLimitScope } from './rateLimiter';

type TestConfig = Record<RateLimitScope, { dailyLimit: number; burstLimit: number; burstWindowMs: number }>;

const TEST_CONFIG: TestConfig = {
  api: { dailyLimit: 10, burstLimit: 3, burstWindowMs: 5_000 },
  llm: { dailyLimit: 5, burstLimit: 10, burstWindowMs: 5_000 },
};

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks requests after burst exhaustion and reports retry window', () => {
    const limiter = new RateLimiter(TEST_CONFIG, () => Date.now());
    const userId = 'user-1';

    limiter.consume(userId, 'api');
    limiter.consume(userId, 'api');
    limiter.consume(userId, 'api');

    try {
      limiter.consume(userId, 'api');
      expect.unreachable('Expected a RateLimitError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      const rateLimitError = error as RateLimitError;

      expect(rateLimitError.scope).toBe('api');
      expect(rateLimitError.reason).toBe('burst');
      expect(rateLimitError.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('resets burst and daily limits after their windows expire', () => {
    const limiter = new RateLimiter(TEST_CONFIG, () => Date.now());
    const userId = 'user-2';

    limiter.consume(userId, 'llm');

    vi.advanceTimersByTime(5_001);

    expect(() => limiter.consume(userId, 'llm')).not.toThrow();

    vi.advanceTimersByTime(5_001);

    limiter.consume(userId, 'llm');
    limiter.consume(userId, 'llm');
    limiter.consume(userId, 'llm');

    expect(() => limiter.consume(userId, 'llm')).toThrowError(RateLimitError);

    try {
      limiter.consume(userId, 'llm');
      expect.unreachable('Expected daily rate limit to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      const rateLimitError = error as RateLimitError;

      expect(rateLimitError.reason).toBe('daily');
    }

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    expect(() => limiter.consume(userId, 'llm')).not.toThrow();
  });
});
