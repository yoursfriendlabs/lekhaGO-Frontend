import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Parties from './Parties.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const apiMocks = vi.hoisted(() => ({
  createParty: vi.fn(),
  listParties: vi.fn(),
  partyStatement: vi.fn(),
}));
const partyStoreMocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  remove: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api');

  return {
    ...actual,
    api: {
      ...actual.api,
      createParty: apiMocks.createParty,
      listParties: apiMocks.listParties,
      partyStatement: apiMocks.partyStatement,
    },
  };
});

vi.mock('../stores/parties', () => ({
  usePartyStore: () => partyStoreMocks,
}));

describe('Parties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listParties.mockResolvedValue({ items: [], total: 0 });
    apiMocks.partyStatement.mockResolvedValue({});
    apiMocks.createParty.mockResolvedValue({
      id: 'supplier-party-1',
      name: 'Riya',
      type: 'supplier',
    });
  });

  it('filters and creates supplier parties', async () => {
    window.localStorage.setItem('mms_token', 'token-123');
    window.localStorage.setItem('mms_role', 'owner');
    window.localStorage.setItem('mms_business_id', 'business-123');
    window.localStorage.setItem('mms_user', JSON.stringify({ id: 'user-1', name: 'Owner', role: 'owner' }));

    renderWithProviders(<Parties />, { route: '/app/parties', withAuth: true });

    const supplierFilterButton = await screen.findByRole('button', { name: 'Supplier' });
    fireEvent.click(supplierFilterButton);

    await waitFor(() => {
      expect(apiMocks.listParties).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'supplier' }),
        expect.any(Object)
      );
    });

    fireEvent.click(screen.getAllByRole('button', { name: /add party/i })[0]);

    const supplierButtons = screen.getAllByRole('button', { name: 'Supplier' });
    expect(supplierButtons).toHaveLength(2);
    fireEvent.click(supplierButtons[1]);

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { value: 'Riya' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
        expect(apiMocks.createParty).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Riya',
            type: 'supplier',
          })
        );
    });
  });
});
