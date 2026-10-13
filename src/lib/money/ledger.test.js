import { describe, expect, it } from 'vitest';
import { formatLedgerNote, normalizeLedgerReportResponse, normalizeLedgerRow } from './ledger';

describe('ledger helpers', () => {
  it('preserves backend debit, credit, and running balance values as-is', () => {
    const row = normalizeLedgerRow({
      id: 'row-1',
      type: 'payment_out',
      referenceNo: null,
      date: '2026-05-19T10:15:00.000Z',
      partyName: null,
      debit: 2500,
      credit: 0,
      runningBalance: -1250.5,
    });

    expect(row.referenceNo).toBeNull();
    expect(row.partyName).toBeNull();
    expect(row.debit).toBe(2500);
    expect(row.credit).toBe(0);
    expect(row.runningBalance).toBe(-1250.5);
  });

  it('shows the full bill amount on a fully paid sale instead of an empty row', () => {
    const row = normalizeLedgerRow({
      id: 'row-paid-sale',
      type: 'sale',
      referenceNo: 'SAL-0099',
      date: '2026-05-19T10:15:00.000Z',
      totalAmount: 5000,
      paidAmount: 5000,
      amount: 0,
      debit: 0,
      credit: 0,
      runningBalance: 0,
    });

    expect(row.debit).toBe(5000);
    expect(row.credit).toBe(0);
  });

  it('shows the full bill amount on a partially paid sale', () => {
    const row = normalizeLedgerRow({
      id: 'row-partial-sale',
      type: 'sale',
      totalAmount: 1000,
      paidAmount: 400,
      amount: 0,
      debit: 600,
      credit: 0,
    });

    expect(row.debit).toBe(1000);
    expect(row.credit).toBe(0);
  });

  it('shows the full bill amount on a fully paid purchase', () => {
    const row = normalizeLedgerRow({
      id: 'row-paid-purchase',
      type: 'purchase',
      totalAmount: 2000,
      paidAmount: 2000,
      amount: 0,
      debit: 0,
      credit: 0,
    });

    expect(row.debit).toBe(0);
    expect(row.credit).toBe(2000);
  });

  it('keeps payment rows on their natural side', () => {
    const paymentIn = normalizeLedgerRow({
      id: 'row-pay-in',
      type: 'payment_in',
      totalAmount: 300,
      amount: 300,
      debit: 0,
      credit: 300,
    });
    const paymentOut = normalizeLedgerRow({
      id: 'row-pay-out',
      type: 'payment_out',
      totalAmount: 150,
      amount: 150,
      debit: 150,
      credit: 0,
    });

    expect(paymentIn.debit).toBe(0);
    expect(paymentIn.credit).toBe(300);
    expect(paymentOut.debit).toBe(150);
    expect(paymentOut.credit).toBe(0);
  });

  it('keeps null running balances and normalizes report pagination fields', () => {
    const report = normalizeLedgerReportResponse({
      items: [
        {
          id: 'row-2',
          type: 'sale',
          referenceNo: 'SAL-0012',
          date: '2026-05-19T10:15:00.000Z',
          debit: 0,
          credit: 980,
          runningBalance: null,
          paymentType: {
            method: 'bank',
            bank: {
              id: 'bank-1',
              name: 'Nabil',
              currentAmount: 1200,
              currentBalance: 1200,
            },
          },
        },
      ],
      total: 42,
      limit: 10,
      offset: 20,
    });

    expect(report.total).toBe(42);
    expect(report.limit).toBe(10);
    expect(report.offset).toBe(20);
    expect(report.items).toHaveLength(1);
    expect(report.items[0].runningBalance).toBeNull();
    expect(report.items[0].paymentType.bank.name).toBe('Nabil');
  });

  it('trims ledger notes and localizes the opening-balance system note', () => {
    const row = normalizeLedgerRow({
      id: 'row-3',
      type: 'payment_in',
      note: '  Advance for next order  ',
    });

    expect(row.note).toBe('Advance for next order');
    expect(formatLedgerNote('')).toBe('');
    expect(formatLedgerNote('Opening Balance', (key) => (
      key === 'parties.openingBalanceNote' ? 'Opening Balance' : key
    ))).toBe('Opening Balance');
    expect(formatLedgerNote('Paid in cash')).toBe('Paid in cash');
  });
});
