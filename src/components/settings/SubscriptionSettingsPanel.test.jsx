import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SubscriptionSettingsPanel from './SubscriptionSettingsPanel.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';

const apiMocks = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  getPaymentsSetup: vi.fn(),
  getSubscriptionPaymentSetup: vi.fn(),
  updateSubscription: vi.fn(),
  initiatePayment: vi.fn(),
}));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');

  return {
    ...actual,
    api: {
      ...actual.api,
      getSubscription: apiMocks.getSubscription,
      getPaymentsSetup: apiMocks.getPaymentsSetup,
      getSubscriptionPaymentSetup: apiMocks.getSubscriptionPaymentSetup,
      updateSubscription: apiMocks.updateSubscription,
      initiatePayment: apiMocks.initiatePayment,
    },
  };
});

function seedOwnerSession() {
  window.localStorage.setItem('mms_token', 'token-123');
  window.localStorage.setItem('mms_business_id', 'biz-123');
  window.localStorage.setItem('mms_role', 'owner');
  window.localStorage.setItem('mms_user', JSON.stringify({
    id: 'user-123',
    name: 'Owner User',
    email: 'owner@example.com',
    role: 'owner',
    emailVerified: true,
    isActive: true,
  }));
}

describe('SubscriptionSettingsPanel', () => {
  beforeEach(() => {
    apiMocks.getSubscription.mockReset();
    apiMocks.getPaymentsSetup.mockReset();
    apiMocks.getSubscriptionPaymentSetup.mockReset();
    apiMocks.updateSubscription.mockReset();
    apiMocks.initiatePayment.mockReset();
    window.localStorage.clear();
    seedOwnerSession();
  });

  it('shows provider selection only for paid plans and blocks unconfigured providers before checkout', async () => {
    apiMocks.getSubscription.mockResolvedValue({
      businessId: 'biz-123',
      currentPlan: {
        key: 'freemium',
        label: 'Freemium',
        billingCycle: 'free',
        subscriptionStatus: 'free',
      },
      pendingChange: null,
      availablePlans: [
        {
          key: 'freemium',
          label: 'Freemium',
          isPaid: false,
          billingOptions: [{ cycle: 'free' }],
        },
        {
          key: 'growth',
          label: 'Growth',
          isPaid: true,
          billingOptions: [{ cycle: 'monthly', amountConfigured: true, amount: 1999 }],
        },
      ],
    });
    apiMocks.getPaymentsSetup.mockResolvedValue({
      providers: {
        esewa: {
          configured: false,
          message: 'eSewa checkout is not configured yet.',
        },
        khalti: {
          configured: true,
          message: 'Khalti is ready.',
        },
      },
    });
    apiMocks.updateSubscription.mockResolvedValue({
      message: 'Subscription request saved.',
    });

    const user = userEvent.setup();

    renderWithProviders(<SubscriptionSettingsPanel isOwner />, {
      route: '/app/settings?tab=subscription',
      withAuth: true,
    });

    await screen.findByText(/Growth/i);

    const freemiumCard = document.getElementById('subscription-plan-freemium');
    const growthCard = document.getElementById('subscription-plan-growth');

    expect(freemiumCard).not.toBeNull();
    expect(growthCard).not.toBeNull();
    expect(within(freemiumCard).queryByText(/Payment provider/i)).not.toBeInTheDocument();
    expect(within(growthCard).getByText(/Payment provider/i)).toBeInTheDocument();

    await user.click(within(growthCard).getByRole('button', { name: /^eSewa/i }));
    await user.click(within(growthCard).getByRole('button', { name: /Continue with eSewa/i }));

    await waitFor(() => {
      expect(apiMocks.updateSubscription).toHaveBeenCalledWith({
        plan: 'growth',
        billingCycle: 'monthly',
        paymentProvider: 'esewa',
      });
    });

    expect(apiMocks.initiatePayment).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getAllByText(/eSewa checkout is not configured yet/i).length).toBeGreaterThan(0);
    });
  });
});
