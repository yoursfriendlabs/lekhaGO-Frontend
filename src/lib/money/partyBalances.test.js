import { describe, expect, it } from 'vitest';
import { getPartyBalanceMeta, getStatementRunningBalanceMeta, normalizePartyStatementResponse } from './partyBalances.js';

const t = (key) => ({
  'parties.toReceive': 'To Receive',
  'parties.toGive': 'To Pay',
  'parties.settled': 'Settled',
}[key] || key);

describe('getPartyBalanceMeta', () => {
  it('treats a negative currentAmount as To Receive (unpaid sales or services)', () => {
    const meta = getPartyBalanceMeta(-100, t);
    expect(meta.tone).toBe('receive');
    expect(meta.label).toBe('To Receive');
    expect(meta.absoluteAmount).toBe(100);
  });

  it('treats a positive currentAmount as To Pay (unpaid purchases or expenses)', () => {
    const meta = getPartyBalanceMeta(150, t);
    expect(meta.tone).toBe('pay');
    expect(meta.label).toBe('To Pay');
    expect(meta.absoluteAmount).toBe(150);
  });

  it('treats a zero currentAmount as settled', () => {
    const meta = getPartyBalanceMeta(0, t);
    expect(meta.tone).toBe('settled');
    expect(meta.label).toBe('Settled');
    expect(meta.absoluteAmount).toBe(0);
  });
});

describe('normalizePartyStatementResponse', () => {
  it('keeps runningBalance from the backend without recomputing it', () => {
    const normalized = normalizePartyStatementResponse({
      items: [{
        id: 'sale-1',
        type: 'sale',
        dueAmount: 100,
        runningBalance: -1250.5,
      }],
      summary: {
        totalRows: 1,
        runningBalance: -1250.5,
      },
    });

    expect(normalized.rows[0].runningBalance).toBe(-1250.5);
    expect(normalized.summary.runningBalance).toBe(-1250.5);
  });

  it('accepts snake_case running_balance from the API', () => {
    const normalized = normalizePartyStatementResponse({
      items: [{ id: 'sale-1', running_balance: '80' }],
      summary: { running_balance: '80' },
    });

    expect(normalized.rows[0].runningBalance).toBe(80);
    expect(normalized.summary.runningBalance).toBe(80);
  });

  it('leaves runningBalance null when the API omits it', () => {
    const normalized = normalizePartyStatementResponse({
      items: [{ id: 'sale-1', type: 'sale' }],
    });

    expect(normalized.rows[0].runningBalance).toBeNull();
    expect(normalized.summary.runningBalance).toBeNull();
  });
});

describe('getStatementRunningBalanceMeta', () => {
  it('uses runningBalance, not the row amount', () => {
    const meta = getStatementRunningBalanceMeta({
      amount: 3000,
      totalAmount: 3000,
      runningBalance: -5100,
    }, t);

    expect(meta.absoluteAmount).toBe(5100);
    expect(meta.label).toBe('To Receive');
  });
});
