import { describe, expect, it } from 'vitest';
import {
  getSellableQuantity,
  getStockAvailabilityMessage,
  isAllStockExpired,
  isExpiryDateExpired,
} from './stockAvailability';

describe('stockAvailability', () => {
  it('treats dates before today as expired', () => {
    expect(isExpiryDateExpired('2026-08-01', '2026-08-23')).toBe(true);
    expect(isExpiryDateExpired('2026-08-23', '2026-08-23')).toBe(false);
    expect(isExpiryDateExpired('', '2026-08-23')).toBe(false);
  });

  it('prefers sellableQuantity from the API', () => {
    expect(getSellableQuantity({ stockOnHand: 10, sellableQuantity: 4 })).toBe(4);
  });

  it('detects when every remaining unit is expired', () => {
    expect(isAllStockExpired({
      stockOnHand: 8,
      sellableQuantity: 0,
      expiredQuantity: 8,
      hasExpiredStock: true,
    })).toBe(true);
    expect(isAllStockExpired({ stockOnHand: 0, sellableQuantity: 0 })).toBe(false);
  });

  it('maps backend expiry codes to user-facing copy', () => {
    const t = (key) => key;
    expect(getStockAvailabilityMessage(
      { payload: { code: 'ALL_STOCK_EXPIRED' } },
      t,
    )).toBe('sales.allStockExpired');
    expect(getStockAvailabilityMessage(
      { payload: { code: 'ALL_STOCK_EXPIRED', productName: 'Milk' } },
      t,
      'Milk',
    )).toBe('sales.allStockExpiredNamed');
  });
});
