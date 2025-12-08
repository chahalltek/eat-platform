import { describe, expect, it } from 'vitest';

import {
  MockBillingProvider,
  type SubscriptionStatus,
  type TenantSubscription,
} from './billingProvider';

describe('MockBillingProvider', () => {
  it('creates checkout sessions and tracks pending subscriptions', async () => {
    const provider = new MockBillingProvider();

    const session = await provider.createCheckoutSession('tenant-123', 'pro');
    const subscription = provider.getSubscription('tenant-123') as TenantSubscription;

    expect(session).toMatchObject({
      tenantId: 'tenant-123',
      planId: 'pro',
      checkoutUrl: 'https://billing.local/checkout/sess_1',
      sessionId: 'sess_1',
    });
    expect(subscription.status).toBe<SubscriptionStatus>('pending');
  });

  it('updates subscription on webhook events', async () => {
    const provider = new MockBillingProvider();
    await provider.createCheckoutSession('tenant-321', 'starter');

    await provider.handleBillingWebhook({
      type: 'subscription.active',
      data: { tenantId: 'tenant-321', planId: 'starter' },
    });

    const activeSubscription = provider.getSubscription('tenant-321');
    expect(activeSubscription).toMatchObject({
      tenantId: 'tenant-321',
      planId: 'starter',
      status: 'active',
    });

    await provider.handleBillingWebhook({
      type: 'subscription.canceled',
      data: { tenantId: 'tenant-321' },
    });

    const canceledSubscription = provider.getSubscription('tenant-321');
    expect(canceledSubscription).toMatchObject({
      tenantId: 'tenant-321',
      planId: 'starter',
      status: 'canceled',
    });
  });

  it('keeps existing plan information when webhook omits it', async () => {
    const provider = new MockBillingProvider();
    await provider.createCheckoutSession('tenant-555', 'premium');

    await provider.handleBillingWebhook({
      type: 'subscription.active',
      data: { tenantId: 'tenant-555' },
    });

    expect(provider.getSubscription('tenant-555')).toEqual({
      tenantId: 'tenant-555',
      planId: 'premium',
      status: 'active',
    });
  });

  it('creates subscriptions from webhook when missing locally', async () => {
    const provider = new MockBillingProvider();

    await provider.handleBillingWebhook({
      type: 'subscription.incomplete',
      data: { tenantId: 'tenant-000' },
    });

    expect(provider.getSubscription('tenant-000')).toEqual({
      tenantId: 'tenant-000',
      planId: 'unknown-plan',
      status: 'incomplete',
    });
  });

  it('rejects invalid events gracefully', async () => {
    const provider = new MockBillingProvider();

    await expect(provider.handleBillingWebhook('not-an-event')).rejects.toThrow(
      'Invalid billing event payload',
    );
    await expect(
      provider.handleBillingWebhook({ type: 'unknown', data: { tenantId: 'bad' } }),
    ).rejects.toThrow('Invalid billing event payload');
  });
});
