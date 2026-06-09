import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../lib/auth.jsx';
import { I18nProvider } from '../lib/i18n.jsx';
import { BusinessSettingsProvider } from '../lib/businessSettings.jsx';
import Topbar from './Topbar.jsx';

function renderTopbar() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <AuthProvider>
          <BusinessSettingsProvider>
            <Topbar />
          </BusinessSettingsProvider>
        </AuthProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

function seedSession(subscription) {
  window.localStorage.setItem('mms_token', 'token-123');
  window.localStorage.setItem('mms_role', 'owner');
  window.localStorage.setItem('mms_user', JSON.stringify({ name: 'Dipesh', role: 'owner' }));
  window.localStorage.setItem('mms_business_profile', JSON.stringify({ label: 'ManageMyShop Demo' }));
  window.localStorage.setItem('mms_subscription', JSON.stringify(subscription));
}

describe('Topbar', () => {
  it('shows the trial time left instead of the upgrade action while trial is active', () => {
    seedSession({
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
    });

    renderTopbar();

    expect(screen.getByText(/5 days remaining/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^upgrade$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/refresh/i)).not.toBeInTheDocument();
  });

  it('brings back the upgrade action after the trial has expired', () => {
    seedSession({
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
    });

    renderTopbar();

    expect(screen.getByRole('button', { name: /^upgrade$/i })).toBeInTheDocument();
    expect(screen.queryByText(/days remaining/i)).not.toBeInTheDocument();
  });
});
