import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import PaymentCallback from './PaymentCallback.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const apiMocks = vi.hoisted(() => ({
  verifyPayment: vi.fn(),
  getSubscription: vi.fn(),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api');

  return {
    ...actual,
    api: {
      ...actual.api,
      verifyPayment: apiMocks.verifyPayment,
      getSubscription: apiMocks.getSubscription,
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

describe('PaymentCallback', () => {
  beforeEach(() => {
    apiMocks.verifyPayment.mockReset();
    apiMocks.getSubscription.mockReset();
    window.localStorage.clear();
    seedOwnerSession();
  });

  it('verifies the eSewa return payload and refreshes subscription data after success', async () => {
    apiMocks.verifyPayment.mockResolvedValue({
      success: true,
      status: 'completed',
      message: 'Payment verified successfully.',
    });
    apiMocks.getSubscription.mockResolvedValue({
      businessId: 'biz-123',
      currentPlan: {
        key: 'growth',
        label: 'Growth',
        billingCycle: 'monthly',
        subscriptionStatus: 'active',
      },
      pendingChange: null,
      availablePlans: [],
    });

    renderWithProviders(<PaymentCallback provider="esewa" outcome="success" />, {
      route: '/payment/esewa/success?data=encoded-esewa-response',
      withAuth: true,
    });

    await waitFor(() => {
      expect(apiMocks.verifyPayment).toHaveBeenCalledWith({
        provider: 'esewa',
        data: 'encoded-esewa-response',
      });
    });

    await waitFor(() => {
      expect(apiMocks.getSubscription).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/Payment verified successfully/i)).toBeInTheDocument();
    expect(screen.getAllByText(/completed/i)).toHaveLength(2);
  });
});
