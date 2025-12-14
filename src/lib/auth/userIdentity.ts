import { Prisma, type User } from '@/server/db';

import { prisma } from '@/server/db';
import { assertTenantWithinLimits } from '@/lib/subscription/usageLimits';

import { AuthFailureError } from '@/lib/errors';

import { DEFAULT_TENANT_ID } from './config';
import { USER_ROLES, normalizeRole } from './roles';

export type IdentityLinkingErrorCode = 'IDENTITY_ALREADY_LINKED' | 'IDENTITY_PERSISTENCE_FAILED';

export class IdentityLinkingError extends AuthFailureError {
  constructor(
    message: string,
    public readonly code: IdentityLinkingErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message, 'We could not link your account. Please try again.');
    this.name = 'IdentityLinkingError';
  }
}

export type ProviderIdentityClaims = {
  provider: string;
  subject: string;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
  tenantId?: string | null;
};

export type FindOrCreateUserOptions = {
  matchEmail?: boolean;
};

function normalizeClaims(claims: ProviderIdentityClaims) {
  const provider = claims.provider.trim();
  const subject = claims.subject.trim();

  if (!provider || !subject) {
    throw new Error('Provider and subject are required to link identities.');
  }

  return { provider, subject };
}

function resolveTenantId(claims: ProviderIdentityClaims) {
  return claims.tenantId?.trim() || DEFAULT_TENANT_ID;
}

function resolveUserProfile(claims: ProviderIdentityClaims, tenantId: string) {
  if (!claims.email) {
    throw new Error('Email is required to create a new user from identity claims.');
  }

  return {
    tenantId,
    email: claims.email,
    displayName: claims.displayName?.trim() || claims.email,
    role: normalizeRole(claims.role) ?? USER_ROLES.RECRUITER,
  } satisfies Pick<User, 'tenantId' | 'email' | 'displayName' | 'role'>;
}

async function ensureNoConflictingIdentity(userId: string, provider: string, subject: string) {
  const existingProviderIdentity = await prisma.userIdentity.findFirst({
    where: { userId, provider },
  });

  if (existingProviderIdentity && existingProviderIdentity.subject !== subject) {
    throw new Error(
      `User is already linked to provider ${provider} with subject ${existingProviderIdentity.subject}.`,
    );
  }
}

function isUniqueIdentityError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function attachIdentityToUser(userId: string, provider: string, subject: string) {
  try {
    return await prisma.userIdentity.create({
      data: { userId, provider, subject },
    });
  } catch (error) {
    if (isUniqueIdentityError(error)) {
      throw new IdentityLinkingError(
        `Identity for provider ${provider} and subject ${subject} already exists.`,
        'IDENTITY_ALREADY_LINKED',
        error,
      );
    }

    const reason = error instanceof Error ? error.message : 'Unknown error';
    throw new IdentityLinkingError(
      `Failed to persist identity link: ${reason}`,
      'IDENTITY_PERSISTENCE_FAILED',
      error,
    );
  }
}

export async function findOrCreateUserFromIdentity(
  claims: ProviderIdentityClaims,
  options: FindOrCreateUserOptions = {},
) {
  const { provider, subject } = normalizeClaims(claims);
  const matchEmail = options.matchEmail ?? true;
  const tenantId = resolveTenantId(claims);

  const existingIdentity = await prisma.userIdentity.findUnique({
    where: { provider_subject: { provider, subject } },
    include: { user: true },
  });

  if (existingIdentity) {
    return existingIdentity.user;
  }

  const emailFromClaims = claims.email?.trim();
  const emailLookupUser = emailFromClaims
    ? await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: emailFromClaims } } })
    : null;

  if (emailLookupUser && !matchEmail) {
    throw new Error('Identity email matches an existing user but email linking is disabled.');
  }

  if (emailLookupUser) {
    await ensureNoConflictingIdentity(emailLookupUser.id, provider, subject);
    await attachIdentityToUser(emailLookupUser.id, provider, subject);
    return emailLookupUser;
  }

  await assertTenantWithinLimits(tenantId, 'createUser');

  const newUser = await prisma.user.create({ data: resolveUserProfile(claims, tenantId) });
  await attachIdentityToUser(newUser.id, provider, subject);
  return newUser;
}
