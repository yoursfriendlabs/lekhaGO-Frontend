import { describe, expect, it } from 'vitest';
import {
  canAccessFeature,
  getPreferredBillingCycle,
  getSubscriptionStatusState,
  normalizePaymentSetupPayload,
  normalizeSubscriptionPayload,
} from './subscription';

describe('subscription helpers', () => {
  it('normalizes access flags and preserves plan data', () => {
    const subscription = normalizeSubscriptionPayload({
      businessId: 'biz-123',
      currentPlan: {
        key: 'growth',
        label: 'Growth',
        subscriptionStatus: 'active',
        isTrial: true,
        trial: {
          durationMonths: 1,
          startsAt: '2026-05-01T00:00:00.000Z',
          endsAt: '2026-06-01T00:00:00.000Z',
          status: 'active',
          daysRemaining: 20,
          hasEnded: false,
        },
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
    expect(subscription?.currentPlan?.isTrial).toBe(true);
    expect(subscription?.currentPlan?.trial?.endsAt).toBe('2026-06-01T00:00:00.000Z');
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

  it('unlocks all feature-gated areas while an active trial is still running', () => {
    const access = normalizeSubscriptionPayload({
      currentPlan: {
        key: 'freemium',
        label: 'Freemium',
        subscriptionStatus: 'active',
        isTrial: true,
        trial: {
          durationMonths: 1,
          startsAt: '2026-05-01T00:00:00.000Z',
          endsAt: '2026-06-01T00:00:00.000Z',
          status: 'active',
          daysRemaining: 12,
          hasEnded: false,
        },
      },
      access: {
        canUseApplication: true,
        planKey: 'freemium',
        subscriptionStatus: 'active',
      },
    });

    expect(canAccessFeature(access, 'purchases')).toBe(true);
    expect(canAccessFeature(access, 'parties')).toBe(true);
    expect(canAccessFeature(access, 'analytics')).toBe(true);
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

  it('derives trial and expired states from backend fields instead of free billing labels', () => {
    const trialState = getSubscriptionStatusState({
      currentPlan: {
        key: 'freemium',
        label: 'Freemium',
        billingStatus: 'free',
        subscriptionStatus: 'active',
        isTrial: true,
        trial: {
          durationMonths: 1,
          startsAt: '2026-05-01T00:00:00.000Z',
          endsAt: '2026-06-01T00:00:00.000Z',
          status: 'active',
          daysRemaining: 5,
          hasEnded: false,
        },
      },
      access: {
        canUseApplication: true,
        planKey: 'freemium',
        subscriptionStatus: 'active',
      },
    });

    const freeButNotTrialState = getSubscriptionStatusState({
      currentPlan: {
        key: 'freemium',
        label: 'Freemium',
        billingStatus: 'free',
        subscriptionStatus: 'active',
        isTrial: false,
        trial: null,
      },
      access: {
        canUseApplication: false,
        guard: 'subscription_expired',
        planKey: 'freemium',
        subscriptionStatus: 'expired',
      },
    });

    expect(trialState.kind).toBe('trial-expiring');
    expect(trialState.isTrialActive).toBe(true);
    expect(freeButNotTrialState.isTrialActive).toBe(false);
    expect(freeButNotTrialState.kind).toBe('expired');
  });

  it('keeps feature access open when business context is recovered from a cached business id', () => {
    const subscription = normalizeSubscriptionPayload(
      {
        access: {
          canUseApplication: false,
          guard: 'business_missing',
          planKey: null,
          subscriptionStatus: 'untracked',
        },
      },
      {
        businessId: 'biz-123',
      }
    );

    expect(subscription?.businessId).toBe('biz-123');
    expect(subscription?.access?.canUseApplication).toBe(true);
    expect(canAccessFeature(subscription, 'inventory')).toBe(true);
  });
});
