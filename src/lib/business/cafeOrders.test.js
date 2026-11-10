import { describe, expect, it } from 'vitest';
import { checkNewAndReadyOrders, findActiveTableOrder, isCafeOrderFlowEnabled } from './cafeOrders';
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

describe('active table order', () => {
  const paidOpen = { id: 'a', tableId: 't1', status: 'paid', attributes: { order_status: 'new' } };
  const paidDone = { id: 'b', tableId: 't1', status: 'paid', attributes: { order_status: 'completed' } };
  const due = { id: 'c', tableId: 't1', status: 'due', attributes: { order_status: 'ready' } };

  it('finds an order paid when it was placed on an occupied table', () => {
    expect(findActiveTableOrder([paidDone, paidOpen], 't1', { occupied: true })).toBe(paidOpen);
  });

  it('prefers the unpaid order', () => {
    expect(findActiveTableOrder([paidOpen, due], 't1', { occupied: true })).toBe(due);
    expect(findActiveTableOrder([due], 't1')).toBe(due);
  });

  it('ignores completed orders and other tables', () => {
    expect(findActiveTableOrder([paidDone], 't1', { occupied: true })).toBeNull();
    expect(findActiveTableOrder([paidOpen], 't2', { occupied: true })).toBeNull();
    expect(findActiveTableOrder([paidOpen], 't1')).toBeNull();
  });
});
