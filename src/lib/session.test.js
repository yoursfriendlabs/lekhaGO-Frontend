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

  it('merges fallback user fields over the response user so explicit profile overrides survive', () => {
    const snapshot = normalizeSessionPayload(
      {
        user: {
          id: 'user-1',
          name: 'Old Name',
          email: 'old@example.com',
          role: 'staff',
        },
        business: null,
        businessProfile: null,
        role: 'staff',
      },
      {
        token: 'tok-1',
        user: {
          id: 'user-1',
          name: 'New Name',
          phone: '9800000000',
          avatarUrl: 'https://cdn.test/avatar.jpg',
        },
      }
    );

    expect(snapshot.user?.id).toBe('user-1');
    expect(snapshot.user?.name).toBe('New Name');
    expect(snapshot.user?.phone).toBe('9800000000');
    expect(snapshot.user?.avatarUrl).toBe('https://cdn.test/avatar.jpg');
  });
});
