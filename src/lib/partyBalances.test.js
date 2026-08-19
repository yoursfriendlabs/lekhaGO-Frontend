import { describe, expect, it } from 'vitest';
import { getPartyBalanceMeta } from './partyBalances.js';

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
