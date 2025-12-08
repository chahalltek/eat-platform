export type SubscriptionStatus = 'pending' | 'active' | 'canceled' | 'incomplete';

export interface TenantSubscription {
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
}

export interface CheckoutSession {
  checkoutUrl: string;
  sessionId: string;
  tenantId: string;
  planId: string;
}

export interface BillingProvider {
  createCheckoutSession(tenantId: string, planId: string): Promise<CheckoutSession>;
  handleBillingWebhook(eventPayload: unknown): Promise<void>;
}

type BillingEventType = 'subscription.active' | 'subscription.canceled' | 'subscription.incomplete';

interface BillingEvent {
  type: BillingEventType;
  data: {
    tenantId: string;
    planId?: string;
  };
}

function isBillingEvent(payload: unknown): payload is BillingEvent {
  if (!payload || typeof payload !== 'object') return false;

  const candidate = payload as Partial<BillingEvent>;

  return (
    typeof candidate.type === 'string' &&
    (candidate.type === 'subscription.active' ||
      candidate.type === 'subscription.canceled' ||
      candidate.type === 'subscription.incomplete') &&
    !!candidate.data &&
    typeof candidate.data.tenantId === 'string'
  );
}

export class MockBillingProvider implements BillingProvider {
  private subscriptions = new Map<string, TenantSubscription>();
  private sessionCounter = 0;

  async createCheckoutSession(tenantId: string, planId: string): Promise<CheckoutSession> {
    const sessionId = `sess_${++this.sessionCounter}`;
    const checkoutUrl = `https://billing.local/checkout/${sessionId}`;

    this.subscriptions.set(tenantId, { tenantId, planId, status: 'pending' });

    return {
      checkoutUrl,
      sessionId,
      tenantId,
      planId,
    };
  }

  async handleBillingWebhook(eventPayload: unknown): Promise<void> {
    if (!isBillingEvent(eventPayload)) {
      throw new Error('Invalid billing event payload');
    }

    const { data, type } = eventPayload;
    const existingSubscription = this.subscriptions.get(data.tenantId);

    const subscription: TenantSubscription = existingSubscription ?? {
      tenantId: data.tenantId,
      planId: data.planId ?? 'unknown-plan',
      status: 'pending',
    };

    switch (type) {
      case 'subscription.active':
        this.subscriptions.set(data.tenantId, {
          ...subscription,
          status: 'active',
          planId: data.planId ?? subscription.planId,
        });
        return;
      case 'subscription.canceled':
        this.subscriptions.set(data.tenantId, {
          ...subscription,
          status: 'canceled',
          planId: data.planId ?? subscription.planId,
        });
        return;
      case 'subscription.incomplete':
        this.subscriptions.set(data.tenantId, {
          ...subscription,
          status: 'incomplete',
          planId: data.planId ?? subscription.planId,
        });
        return;
    }
  }

  getSubscription(tenantId: string): TenantSubscription | undefined {
    return this.subscriptions.get(tenantId);
  }
}

export const billingProvider: BillingProvider = new MockBillingProvider();
