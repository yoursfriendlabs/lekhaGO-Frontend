import { describe, expect, it } from 'vitest';
import { checkNewAndReadyOrders, isCafeOrderFlowEnabled } from './cafeOrders';
import { getDefaultBusinessProfile } from './businessProfile';

describe('cafe order flow gate', () => {
  it('stays off for a standard retail shop', () => {
    expect(isCafeOrderFlowEnabled(getDefaultBusinessProfile('retail'))).toBe(false);
    expect(isCafeOrderFlowEnabled(null)).toBe(false);
  });

  it('turns on for cafe and for any workspace with tables', () => {
    expect(isCafeOrderFlowEnabled(getDefaultBusinessProfile('cafe'))).toBe(true);
    expect(isCafeOrderFlowEnabled({ type: 'retail', modules: { orders: true } })).toBe(true);
    expect(
      isCafeOrderFlowEnabled({ type: 'retail', settings: { enabledModules: ['tables'] } }),
    ).toBe(true);
  });
});

describe('kitchen notifications', () => {
  it('ignores retail sales that carry no order status', () => {
    const messages = checkNewAndReadyOrders([
      { id: 's1' },
      { id: 's2', attributes: { customer_name: 'Walk-in' } },
      { id: 's3', attributes: { order_status: '' } },
    ]);

    expect(messages).toEqual([]);
  });

  it('still announces new and ready cafe orders', () => {
    const messages = checkNewAndReadyOrders([
      { id: 'c1', attributes: { order_status: 'new', table_no: 'T1' } },
      { id: 'c2', attributes: { order_status: 'ready', table_no: 'T2' } },
    ]);

    expect(messages.map((entry) => entry.type)).toEqual(['kitchen', 'waiter']);
  });
});
