import { describe, expect, it } from 'vitest';
import { normalizeSessionPayload } from './session';

describe('session helpers', () => {
  it('preserves the last healthy subscription snapshot when /me degrades to business_missing', () => {
    const snapshot = normalizeSessionPayload(
      {
        user: {
          id: 'user-1',
          name: 'Ranjita Limbu',
          email: 'ranjitas899@gmail.com',
          role: 'owner',
          emailVerified: true,
        },
        business: null,
        businessProfile: null,
        role: 'owner',
        accessControl: {
          role: 'owner',
          permissions: null,
        },
        subscription: {
          businessId: null,
          currentPlan: {
            key: null,
            label: null,
            subscriptionStatus: 'untracked',
          },
          access: {
            planKey: null,
            subscriptionStatus: 'untracked',
            canUseApplication: false,
            guard: 'business_missing',
          },
        },
      },
      {
        token: 'token-123',
        businessId: 'biz-123',
        business: {
          id: 'biz-123',
          name: 'Manage My Shop',
        },
        subscription: {
          businessId: 'biz-123',
          currentPlan: {
            key: 'growth',
            label: 'Growth',
            subscriptionStatus: 'active',
          },
          access: {
            planKey: 'growth',
            subscriptionStatus: 'active',
            canUseApplication: true,
          },
        },
      }
    );

    expect(snapshot.businessId).toBe('biz-123');
    expect(snapshot.business?.id).toBe('biz-123');
    expect(snapshot.subscription?.currentPlan?.key).toBe('growth');
    expect(snapshot.subscription?.access?.planKey).toBe('growth');
    expect(snapshot.subscription?.access?.canUseApplication).toBe(true);
  });
});
