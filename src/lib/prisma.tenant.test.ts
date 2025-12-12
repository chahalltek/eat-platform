import { describe, expect, it } from 'vitest';

import { applyTenantScope } from './prisma';

describe('applyTenantScope', () => {
  it('scopes findUnique queries to the tenant', () => {
    const params = {
      model: 'Candidate',
      action: 'findUnique',
      args: { where: { id: 'abc' } },
    } as const;

    const scoped = applyTenantScope(params, 'tenant-a');

    expect(scoped.action).toBe('findFirst');
    expect(scoped.args).toEqual({ where: { id: 'abc', tenantId: 'tenant-a' } });
  });

  it('adds tenant data on creation', () => {
    const params = {
      model: 'JobReq',
      action: 'create',
      args: { data: { title: 'Engineer' } },
    } as const;

    const scoped = applyTenantScope(params, 'tenant-b');

    expect(scoped.args).toEqual({ data: { title: 'Engineer', tenantId: 'tenant-b' } });
  });

  it('scopes delete operations to the tenant', () => {
    const params = {
      model: 'JobReq',
      action: 'delete',
      args: { where: { id: 'abc' } },
    } as const;

    const scoped = applyTenantScope(params, 'tenant-b');

    expect(scoped.args).toEqual({ where: { id: 'abc', tenantId: 'tenant-b' } });
  });

  it('scopes updates to the tenant for tenanted models', () => {
    const params = {
      model: 'JobReq',
      action: 'update',
      args: { data: { title: 'Updated' }, where: { id: 'abc' } },
    } as const;

    const scoped = applyTenantScope(params, 'tenant-c');

    expect(scoped.args).toEqual({ data: { title: 'Updated' }, where: { id: 'abc', tenantId: 'tenant-c' } });
  });

  it('preserves non-tenanted models', () => {
    const params = {
      model: 'SubscriptionPlan',
      action: 'findMany',
      args: { where: { id: 'x' } },
    } as const;

    const scoped = applyTenantScope(params, 'tenant-c');

    expect(scoped).toBe(params);
  });
});
