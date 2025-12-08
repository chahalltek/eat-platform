import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';

import { DEFAULT_USER_ID, USER_HEADER, USER_QUERY_PARAM } from './config';

function extractUserIdFromRequest(req: NextRequest) {
  const queryValue = req.nextUrl.searchParams.get(USER_QUERY_PARAM);

  if (queryValue && queryValue.trim()) {
    return queryValue.trim();
  }

  const headerValue = req.headers.get(USER_HEADER);

  if (headerValue && headerValue.trim()) {
    return headerValue.trim();
  }

  return null;
}

function extractUserIdFromHeaders() {
  const headerList = headers();

  const headerValue = headerList.get(USER_HEADER);

  if (headerValue && headerValue.trim()) {
    return headerValue.trim();
  }

  return null;
}

export async function getCurrentUser(req?: NextRequest) {
  const userId =
    (req ? extractUserIdFromRequest(req) : extractUserIdFromHeaders()) ??
    DEFAULT_USER_ID;

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, role: true },
  });

  return user;
}
