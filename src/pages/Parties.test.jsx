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
      id: 'staff-party-1',
      name: 'Riya',
      type: 'staff',
    });
  });

  it('filters and creates staff parties', async () => {
    renderWithProviders(<Parties />, { route: '/app/parties' });

    const staffFilterButton = await screen.findByRole('button', { name: 'Staff' });
    fireEvent.click(staffFilterButton);

    await waitFor(() => {
      expect(apiMocks.listParties).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'staff' }),
        expect.any(Object)
      );
    });

    fireEvent.click(screen.getAllByRole('button', { name: /add party/i })[0]);

    const staffButtons = screen.getAllByRole('button', { name: 'Staff' });
    expect(staffButtons).toHaveLength(2);
    fireEvent.click(staffButtons[1]);

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { value: 'Riya' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiMocks.createParty).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Riya',
          type: 'staff',
        })
      );
    });
  });
});
