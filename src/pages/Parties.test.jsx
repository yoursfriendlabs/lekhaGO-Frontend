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

vi.mock('../components/DateDisplay.jsx', () => ({
  default: ({ date }) => <span>{String(date || '')}</span>,
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

  it('lets staff view a party transaction from the party page', async () => {
    window.localStorage.setItem('mms_token', 'token-123');
    window.localStorage.setItem('mms_role', 'owner');
    window.localStorage.setItem('mms_business_id', 'business-123');
    window.localStorage.setItem('mms_user', JSON.stringify({ id: 'user-1', name: 'Owner', role: 'owner' }));

    apiMocks.listParties.mockResolvedValue({
      items: [{
        id: 'party-1',
        name: 'Hari',
        phone: '9800000000',
        type: 'customer',
        currentAmount: 0,
      }],
      total: 1,
    });
    apiMocks.partyStatement.mockResolvedValue({
      party: { id: 'party-1', name: 'Hari', phone: '9800000000', type: 'customer' },
      items: [{
        id: 'sale-1',
        type: 'sale',
        date: '2026-08-01',
        totalAmount: 100,
        paidAmount: 100,
        dueAmount: 0,
      }],
      summary: { totalRows: 1 },
    });

    renderWithProviders(<Parties />, { route: '/app/parties', withAuth: true });

    const viewTransactions = await screen.findByRole('button', { name: 'View transactions' });
    fireEvent.click(viewTransactions);

    const viewLink = await screen.findByRole('link', { name: 'View' });
    expect(viewLink).toHaveAttribute('href', '/app/invoice/sales/sale-1');
  });
});
