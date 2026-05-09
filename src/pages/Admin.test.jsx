import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Admin from './Admin.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const apiMocks = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  listStaff: vi.fn(),
  updateSubscription: vi.fn(),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api');

  return {
    ...actual,
    api: {
      ...actual.api,
      getSubscription: apiMocks.getSubscription,
      listStaff: apiMocks.listStaff,
      updateSubscription: apiMocks.updateSubscription,
    },
  };
});

vi.mock('../lib/businessSettings', () => ({
  useBusinessSettings: () => ({
    settings: {
      companyName: 'Rose Boutique',
    },
  }),
}));

describe('Admin', () => {
  beforeEach(() => {
    apiMocks.getSubscription.mockReset();
    apiMocks.listStaff.mockReset();
    apiMocks.updateSubscription.mockReset();

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
  });

  it('loads the team snapshot once without refetching in a render loop', async () => {
    apiMocks.listStaff.mockResolvedValue({
      summary: {
        maxUsers: 5,
        totalUsers: 1,
        availableSlots: 4,
      },
      members: [
        {
          membershipId: 'membership-123',
          role: 'owner',
          user: {
            id: 'user-123',
            name: 'Owner User',
            email: 'owner@example.com',
            isActive: true,
            emailVerified: true,
          },
        },
      ],
    });
    apiMocks.getSubscription.mockResolvedValue({
      businessId: 'biz-123',
      currentPlan: {
        key: 'growth',
        label: 'Growth',
        billingCycle: 'monthly',
        billingAmount: 1999,
        billingStatus: 'paid',
        subscriptionStatus: 'active',
      },
      pendingChange: null,
      paymentIntegration: null,
      availablePlans: [],
    });

    renderWithProviders(<Admin />, { route: '/app/admin', withAuth: true });

    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(apiMocks.listStaff).toHaveBeenCalledTimes(1);
      expect(apiMocks.getSubscription).toHaveBeenCalledTimes(1);
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(apiMocks.listStaff).toHaveBeenCalledTimes(1);
    expect(apiMocks.getSubscription).toHaveBeenCalledTimes(1);
  });
});
