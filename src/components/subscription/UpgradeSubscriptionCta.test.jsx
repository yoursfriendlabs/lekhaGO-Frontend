import { screen } from '@testing-library/react';
import UpgradeSubscriptionCta from './UpgradeSubscriptionCta.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';

describe('UpgradeSubscriptionCta', () => {
  beforeEach(() => {
    window.localStorage.setItem('mms_token', 'token-123');
    window.localStorage.setItem('mms_role', 'owner');
    window.localStorage.setItem(
      'mms_subscription',
      JSON.stringify({
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
      })
    );
  });

  it('renders a compact sidebar trial summary instead of the large upgrade promo', () => {
    renderWithProviders(<UpgradeSubscriptionCta variant="sidebar" />, { withAuth: true });

    expect(screen.getByText(/your free trial is about to end/i)).toBeInTheDocument();
    expect(screen.getByText(/5 days remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/ends june 1, 2026/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upgrade your plan/i })).toBeInTheDocument();
    expect(screen.queryByText(/unlock more tools/i)).not.toBeInTheDocument();
  });
});
