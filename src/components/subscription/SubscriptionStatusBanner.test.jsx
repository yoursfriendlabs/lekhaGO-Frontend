import { screen } from '@testing-library/react';
import SubscriptionStatusBanner from './SubscriptionStatusBanner.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';

describe('SubscriptionStatusBanner', () => {
  it('renders the free-trial end date and countdown from backend trial fields', () => {
    renderWithProviders(
      <SubscriptionStatusBanner
        subscription={{
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
              daysRemaining: 5,
              hasEnded: false,
            },
          },
          access: {
            canUseApplication: true,
            planKey: 'freemium',
            subscriptionStatus: 'active',
          },
        }}
      />
    );

    expect(screen.getByText(/your free trial is about to end/i)).toBeInTheDocument();
    expect(screen.getByText(/ends on june 1, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/5 days remaining/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review plans/i })).toHaveAttribute(
      'href',
      '/app/settings?tab=subscription'
    );
  });

  it('shows an upgrade CTA when access is blocked by an expired subscription trial', () => {
    renderWithProviders(
      <SubscriptionStatusBanner
        subscription={{
          currentPlan: {
            key: 'freemium',
            label: 'Freemium',
            subscriptionStatus: 'expired',
            isTrial: true,
            trial: {
              durationMonths: 1,
              startsAt: '2026-04-01T00:00:00.000Z',
              endsAt: '2026-05-01T00:00:00.000Z',
              status: 'expired',
              daysRemaining: 0,
              hasEnded: true,
            },
          },
          access: {
            canUseApplication: false,
            guard: 'subscription_expired',
            planKey: 'freemium',
            subscriptionStatus: 'expired',
          },
        }}
      />
    );

    expect(screen.getByText(/your free trial has ended/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /upgrade your plan/i })).toHaveAttribute(
      'href',
      '/app/settings?tab=subscription'
    );
  });
});
