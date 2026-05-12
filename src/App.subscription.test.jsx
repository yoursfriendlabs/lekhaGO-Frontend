import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { SubscriptionFeatureRoute } from './App.jsx';
import { renderWithProviders } from './test/renderWithProviders.jsx';

function SubscriptionRedirectProbe() {
  const location = useLocation();
  const notice = location.state?.notice || null;

  return (
    <div>
      <p>path:{location.pathname}</p>
      <p>search:{location.search}</p>
      <p>title:{notice?.title || ''}</p>
      <p>description:{notice?.description || ''}</p>
    </div>
  );
}

describe('SubscriptionFeatureRoute', () => {
  beforeEach(() => {
    window.localStorage.setItem('mms_token', 'token-123');
    window.localStorage.setItem('mms_business_id', 'biz-123');
    window.localStorage.setItem('mms_role', 'owner');
    window.localStorage.setItem(
      'mms_user',
      JSON.stringify({
        id: 'user-123',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'owner',
        emailVerified: true,
        isActive: true,
      })
    );
    window.localStorage.setItem(
      'mms_subscription',
      JSON.stringify({
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
      })
    );
  });

  it('redirects expired trial access to the subscription settings screen', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/app/inventory"
          element={(
            <SubscriptionFeatureRoute featureKey="inventory">
              <div>Inventory</div>
            </SubscriptionFeatureRoute>
          )}
        />
        <Route path="/app/settings" element={<SubscriptionRedirectProbe />} />
      </Routes>,
      {
        route: '/app/inventory',
        withAuth: true,
      }
    );

    expect(await screen.findByText('path:/app/settings')).toBeInTheDocument();
    expect(screen.getByText('search:?tab=subscription')).toBeInTheDocument();
    expect(screen.getByText(/upgrade your plan to keep using this area/i)).toBeInTheDocument();
    expect(screen.getByText(/workspace trial has ended/i)).toBeInTheDocument();
  });
});
