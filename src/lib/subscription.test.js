import { describe, expect, it } from 'vitest';
import { canAccessFeature, getPreferredBillingCycle, normalizePaymentSetupPayload, normalizeSubscriptionPayload } from './subscription';

describe('subscription helpers', () => {
  it('normalizes access flags and preserves plan data', () => {
    const subscription = normalizeSubscriptionPayload({
      businessId: 'biz-123',
      currentPlan: {
        key: 'growth',
        label: 'Growth',
        subscriptionStatus: 'active',
      },
      access: {
        canUseApplication: true,
        planKey: 'growth',
        subscriptionStatus: 'active',
      },
      availablePlans: [{ key: 'growth', billingOptions: [] }],
    });

    expect(subscription?.businessId).toBe('biz-123');
    expect(subscription?.currentPlan?.label).toBe('Growth');
    expect(subscription?.access?.planKey).toBe('growth');
    expect(subscription?.availablePlans).toHaveLength(1);
  });

  it('blocks freemium-only restricted features while keeping settings accessible', () => {
    const access = normalizeSubscriptionPayload({
      access: {
        canUseApplication: true,
        planKey: 'freemium',
        subscriptionStatus: 'free',
      },
    });

    expect(canAccessFeature(access, 'settings')).toBe(true);
    expect(canAccessFeature(access, 'profile')).toBe(true);
    expect(canAccessFeature(access, 'purchases')).toBe(false);
    expect(canAccessFeature(access, 'analytics')).toBe(false);
  });

  it('normalizes payment setup and preferred billing cycle', () => {
    const paymentSetup = normalizePaymentSetupPayload({
      configuration: { configured: false },
      missingEnvKeys: ['ESEWA_SECRET'],
      nextSteps: [{ title: 'Add credentials' }],
    });

    expect(paymentSetup.configuration.configured).toBe(false);
    expect(paymentSetup.missingEnvKeys).toEqual(['ESEWA_SECRET']);
    expect(paymentSetup.nextSteps).toEqual(['Add credentials']);

    expect(
      getPreferredBillingCycle(
        {
          key: 'growth',
          billingOptions: [{ cycle: 'monthly' }, { cycle: 'yearly' }],
        },
        { key: 'growth', billingCycle: 'yearly' },
        null
      )
    ).toBe('yearly');
  });
});
