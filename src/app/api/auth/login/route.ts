import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSessionCookie } from '@/lib/auth/session';
import { DEFAULT_TENANT_ID } from '@/lib/auth/config';

const VALIDATION_ERROR = { error: 'Invalid email or password' };

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(VALIDATION_ERROR, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(VALIDATION_ERROR, { status: 400 });
  }

  const { email, password } = body as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(VALIDATION_ERROR, { status: 400 });
  }

  const expectedPassword = process.env.AUTH_PASSWORD ?? process.env.AUTH_PASSWORD_LOCAL;
  if (!expectedPassword) {
    return NextResponse.json({ error: 'Authentication not configured' }, { status: 500 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || password !== expectedPassword) {
    return NextResponse.json(VALIDATION_ERROR, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return NextResponse.json(VALIDATION_ERROR, { status: 401 });
  }

  const cookie = createSessionCookie({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
      role: user.role,
      tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
    },
  });

  response.cookies.set(cookie);

  return response;
}
