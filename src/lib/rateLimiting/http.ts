import { NextResponse } from 'next/server';

import { RateLimitError } from './rateLimiter';

export function toRateLimitResponse(error: RateLimitError) {
  const retryAfterSeconds = Math.ceil(error.retryAfterMs / 1000);

  return NextResponse.json(
    { error: error.message, reason: error.reason, scope: error.scope },
    {
      status: 429,
      headers: {
        'Retry-After': `${retryAfterSeconds}`,
      },
    },
  );
}
