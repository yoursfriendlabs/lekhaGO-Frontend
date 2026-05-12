import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PartySearchCreateField from './PartySearchCreateField';

const { createParty, lookupParties } = vi.hoisted(() => ({
  createParty: vi.fn(),
  lookupParties: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    createParty,
    lookupParties,
  },
}));

vi.mock('../lib/i18n.jsx', () => ({
  useI18n: () => ({
    t: (key, params) => {
      const messages = {
        'common.add': 'Add',
        'common.cancel': 'Cancel',
        'common.clear': 'Clear',
        'common.create': 'Create',
        'common.loading': 'Loading...',
        'common.noData': 'No data found.',
        'currency.symbol': 'Rs',
        'errors.phoneMinDigits': 'Phone number must be at least 10 digits.',
        'parties.phonePlaceholder': 'Phone number',
      };

      if (key === 'currency.formatted') {
        return `${params?.symbol || ''}${params?.amount || ''}`;
      }

      return messages[key] || key;
    },
  }),
}));

describe('PartySearchCreateField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupParties.mockImplementation(() => new Promise(() => {}));
  });

  it('does not loop when a selected party prop is rerendered with a new object reference', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const selectedParty = {
      id: 'party-1',
      name: 'Aarav Traders',
      phone: '9800000000',
      type: 'supplier',
      currentAmount: 0,
    };

    try {
      const { rerender } = render(
        <PartySearchCreateField
          type="supplier"
          selectedParty={selectedParty}
          entityLabel="Supplier"
          onSelect={vi.fn()}
        />
      );

      rerender(
        <PartySearchCreateField
          type="supplier"
          selectedParty={{ ...selectedParty }}
          entityLabel="Supplier"
          onSelect={vi.fn()}
        />
      );

      await act(async () => {
        await Promise.resolve();
      });

      const hasDepthWarning = errorSpy.mock.calls.some((call) => (
        call.some((arg) => String(arg).includes('Maximum update depth exceeded'))
      ));

      expect(hasDepthWarning).toBe(false);
      expect(screen.getByText('Aarav Traders')).toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('prevents duplicate create requests while a customer is being created', async () => {
    let resolveCreate;
    const onSelect = vi.fn();

    createParty.mockImplementation(() => new Promise((resolve) => {
      resolveCreate = resolve;
    }));

    render(
      <PartySearchCreateField
        type="customer"
        searchPlaceholder="Search customer"
        entityLabel="Customer"
        onSelect={onSelect}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search customer'), {
      target: { value: 'Alice' },
    });

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    fireEvent.change(screen.getByPlaceholderText('Phone number'), {
      target: { value: '9800000000' },
    });

    const createButton = screen.getByRole('button', { name: 'Create' });

    act(() => {
      fireEvent.click(createButton);
      fireEvent.click(createButton);
    });

    expect(createParty).toHaveBeenCalledTimes(1);
    expect(createButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();

    await act(async () => {
      resolveCreate({ id: 'cust-1', name: 'Alice', phone: '9800000000', type: 'customer' });
      await Promise.resolve();
    });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cust-1',
        name: 'Alice',
        phone: '9800000000',
        type: 'customer',
      })
    );
  });
});
