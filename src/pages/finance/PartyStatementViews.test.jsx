import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatementParticulars } from './PartyStatementViews.jsx';

describe('StatementParticulars', () => {
  it('keeps transaction details without embedding the note', () => {
    render(
      <StatementParticulars
        showParty
        row={{
          referenceDisplay: '2083/84-0004',
          partyDisplay: 'New man',
          typeMeta: { label: 'Service' },
          paymentDisplay: { label: 'Cash' },
          noteDisplay: 'Paid in advance',
        }}
      />,
    );

    expect(screen.getByText('2083/84-0004')).toBeTruthy();
    expect(screen.getByText('New man')).toBeTruthy();
    expect(screen.getByText('Service · Cash')).toBeTruthy();
    expect(screen.queryByText(/Paid in advance/)).toBeNull();
  });

  it('hides empty party and type lines when they are not needed', () => {
    render(
      <StatementParticulars
        showParty={false}
        hideType
        row={{
          referenceDisplay: 'SAL-12',
          partyDisplay: 'Hidden party',
          typeMeta: { label: 'Sale' },
          paymentDisplay: { label: '-' },
          noteDisplay: '',
        }}
      />,
    );

    expect(screen.queryByText('Hidden party')).toBeNull();
    expect(screen.queryByText('Sale')).toBeNull();
    expect(screen.queryByText(/ledger.note/)).toBeNull();
  });
});
