import { describe, expect, it } from 'vitest';
import { getIrdReprintLabel, isIrdCancelled, isIrdLocked } from './ird';

describe('IRD helpers', () => {
  it('treats true, "true", and 1 as locked', () => {
    expect(isIrdLocked({ isLocked: true })).toBe(true);
    expect(isIrdLocked({ isLocked: 'true' })).toBe(true);
    expect(isIrdLocked({ isLocked: 1 })).toBe(true);
    expect(isIrdLocked({ isLocked: false })).toBe(false);
    expect(isIrdLocked({})).toBe(false);
  });

  it('detects cancelled tax-invoice statuses', () => {
    expect(isIrdCancelled({ status: 'cancelled' })).toBe(true);
    expect(isIrdCancelled({ status: 'canceled' })).toBe(true);
    expect(isIrdCancelled({ status: 'void' })).toBe(true);
    expect(isIrdCancelled({ status: 'due' })).toBe(false);
  });

  it('labels reprints only after the original locked print', () => {
    expect(getIrdReprintLabel({ isLocked: true, reprintCount: 0 })).toBe('');
    expect(getIrdReprintLabel({ isLocked: true, reprintCount: 2 })).toBe('Copy of Original – 2');
    expect(getIrdReprintLabel({ isLocked: false, reprintCount: 2 })).toBe('');
  });
});
