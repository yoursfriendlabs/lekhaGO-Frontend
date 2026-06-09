import { describe, expect, it } from 'vitest';
import { normalizeLedgerReportResponse, normalizeLedgerRow } from './ledger';

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
});
