import { NextResponse } from 'next/server';

import { prisma } from '@/server/db/prisma';
import { createSessionCookie } from '@/lib/auth/session';
import { DEFAULT_TENANT_ID } from '@/lib/auth/config';
import { verifyTemporaryPassword } from '@/lib/auth/passwords';

const VALIDATION_ERROR = { error: 'Invalid email or password' };

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  } satisfies Record<string, string>;
}

function withCors(request: Request, response: NextResponse) {
  const headers = corsHeaders(request);

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/login', request.url));
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return withCors(request, NextResponse.json(VALIDATION_ERROR, { status: 400 }));
  }

  if (!body || typeof body !== 'object') {
    return withCors(request, NextResponse.json(VALIDATION_ERROR, { status: 400 }));
  }

  const { email, password } = body as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string') {
    return withCors(request, NextResponse.json(VALIDATION_ERROR, { status: 400 }));
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user) {
    return withCors(request, NextResponse.json(VALIDATION_ERROR, { status: 401 }));
  }

  const expectedPassword = process.env.AUTH_PASSWORD ?? process.env.AUTH_PASSWORD_LOCAL ?? 'password';
  const now = new Date();
  const temporaryPasswordValid =
    typeof user.temporaryPasswordHash === 'string' &&
    user.temporaryPasswordHash.length > 0 &&
    (!user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt >= now) &&
    verifyTemporaryPassword(password, user.temporaryPasswordHash);

  if (password !== expectedPassword && !temporaryPasswordValid) {
    return withCors(request, NextResponse.json(VALIDATION_ERROR, { status: 401 }));
  }

  if (temporaryPasswordValid) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        temporaryPasswordHash: null,
        temporaryPasswordExpiresAt: null,
        temporaryPasswordSetAt: null,
      },
    });
  }

  const cookie = await createSessionCookie({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
  });

  const session = {
    userId: user.id,
    tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
    role: user.role,
    expiresAt: new Date(Date.now() + cookie.maxAge * 1000).toISOString(),
  };

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
      role: user.role,
      tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
    },
    session,
  });

  response.cookies.set(cookie);

  return withCors(request, response);
}
