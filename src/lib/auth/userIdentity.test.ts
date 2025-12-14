import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TENANT_ID } from './config';
import { USER_ROLES, isAdminRole } from './roles';
import {
  IdentityLinkingError,
  findOrCreateUserFromIdentity,
  type ProviderIdentityClaims,
} from './userIdentity';

const prismaMock = vi.hoisted(() => ({
  userIdentity: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

const assertTenantWithinLimits = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({
  prisma: prismaMock,
  Prisma,
}));

vi.mock('@/lib/subscription/usageLimits', () => ({
  assertTenantWithinLimits,
}));

describe('findOrCreateUserFromIdentity', () => {
  const baseClaims: ProviderIdentityClaims = {
    provider: 'okta',
    subject: 'abc-123',
    email: 'person@example.com',
    displayName: 'Person Example',
    role: USER_ROLES.ADMIN,
    tenantId: DEFAULT_TENANT_ID,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('requires provider and subject claims', async () => {
    await expect(
      findOrCreateUserFromIdentity({ ...baseClaims, provider: ' ', subject: '' }),
    ).rejects.toThrow('Provider and subject are required to link identities.');
  });

  it('returns the user associated with an existing identity', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue({
      id: 'identity-1',
      provider: 'okta',
      subject: 'abc-123',
      userId: 'user-1',
      user: { id: 'user-1' },
    });

    const user = await findOrCreateUserFromIdentity(baseClaims);

    expect(prismaMock.userIdentity.findUnique).toHaveBeenCalledWith({
      where: { provider_subject: { provider: 'okta', subject: 'abc-123' } },
      include: { user: true },
    });
    expect(user).toEqual({ id: 'user-1' });
  });

  it('creates a new user and identity for first-time login', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'new-user', ...baseClaims });
    prismaMock.userIdentity.create.mockResolvedValue({
      id: 'identity-2',
      provider: baseClaims.provider,
      subject: baseClaims.subject,
      userId: 'new-user',
    });

    const user = await findOrCreateUserFromIdentity(baseClaims);

    expect(assertTenantWithinLimits).toHaveBeenCalledWith(DEFAULT_TENANT_ID, 'createUser');
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        email: baseClaims.email,
        displayName: baseClaims.displayName,
        role: USER_ROLES.ADMIN,
      },
    });
    expect(prismaMock.userIdentity.create).toHaveBeenCalledWith({
      data: { userId: 'new-user', provider: 'okta', subject: 'abc-123' },
    });
    expect(user.id).toBe('new-user');
  });

  it('defaults missing roles when creating a user', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'role-default', ...baseClaims, role: USER_ROLES.RECRUITER });
    prismaMock.userIdentity.create.mockResolvedValue({
      id: 'identity-role',
      provider: baseClaims.provider,
      subject: baseClaims.subject,
      userId: 'role-default',
    });

    await findOrCreateUserFromIdentity({ ...baseClaims, role: undefined });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        email: baseClaims.email,
        displayName: baseClaims.displayName,
        role: USER_ROLES.RECRUITER,
      },
    });
    expect(isAdminRole(baseClaims.role)).toBe(true);
  });

  it('links to existing user by email when enabled', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      tenantId: DEFAULT_TENANT_ID,
      email: baseClaims.email,
      displayName: 'Existing',
      role: USER_ROLES.RECRUITER,
    });
    prismaMock.userIdentity.findFirst.mockResolvedValue(null);
    prismaMock.userIdentity.create.mockResolvedValue({
      id: 'identity-3',
      provider: baseClaims.provider,
      subject: baseClaims.subject,
      userId: 'existing-user',
    });

    const user = await findOrCreateUserFromIdentity(baseClaims, { matchEmail: true });

    expect(prismaMock.userIdentity.findFirst).toHaveBeenCalledWith({
      where: { userId: 'existing-user', provider: 'okta' },
    });
    expect(assertTenantWithinLimits).not.toHaveBeenCalled();
    expect(user.id).toBe('existing-user');
  });

  it('rejects conflicting provider identities for the same user', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      tenantId: DEFAULT_TENANT_ID,
      email: baseClaims.email,
      displayName: 'Existing',
      role: USER_ROLES.RECRUITER,
    });
    prismaMock.userIdentity.findFirst.mockResolvedValue({
      id: 'identity-4',
      provider: baseClaims.provider,
      subject: 'other-subject',
      userId: 'existing-user',
    });

    await expect(findOrCreateUserFromIdentity(baseClaims)).rejects.toThrow(
      'User is already linked to provider okta with subject other-subject.',
    );
    expect(prismaMock.userIdentity.create).not.toHaveBeenCalled();
  });

  it('throws when email linking is disabled but a user already exists', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      tenantId: DEFAULT_TENANT_ID,
      email: baseClaims.email,
      displayName: 'Existing',
      role: USER_ROLES.RECRUITER,
    });

    await expect(findOrCreateUserFromIdentity(baseClaims, { matchEmail: false })).rejects.toThrow(
      'Identity email matches an existing user but email linking is disabled.',
    );
  });

  it('requires email to create a brand new user', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      findOrCreateUserFromIdentity({
        provider: 'okta',
        subject: 'no-email',
      }),
    ).rejects.toThrow('Email is required to create a new user from identity claims.');
    expect(prismaMock.userIdentity.create).not.toHaveBeenCalled();
  });

  it('surfaces duplicate identity errors when linking concurrently', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'new-user', ...baseClaims });
    prismaMock.userIdentity.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate', { clientVersion: '5.0.0', code: 'P2002' }),
    );

    await expect(findOrCreateUserFromIdentity(baseClaims)).rejects.toMatchObject({
      code: 'IDENTITY_ALREADY_LINKED',
      message: 'Identity for provider okta and subject abc-123 already exists.',
    });
  });

  it('propagates unexpected identity persistence errors', async () => {
    const failure = new Error('db unavailable');

    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      tenantId: DEFAULT_TENANT_ID,
      email: baseClaims.email,
      displayName: 'Existing',
      role: USER_ROLES.RECRUITER,
    });
    prismaMock.userIdentity.findFirst.mockResolvedValue(null);
    prismaMock.userIdentity.create.mockRejectedValue(failure);

    const result = findOrCreateUserFromIdentity(baseClaims);

    await expect(result).rejects.toBeInstanceOf(IdentityLinkingError);
    await expect(result).rejects.toMatchObject({
      code: 'IDENTITY_PERSISTENCE_FAILED',
      message: 'Failed to persist identity link: db unavailable',
    });
  });
});
