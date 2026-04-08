import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DynamicAttributes from './DynamicAttributes';

const { listOrderAttributes } = vi.hoisted(() => ({
  listOrderAttributes: vi.fn().mockResolvedValue({
    items: [
      { key: 'order_type', name: 'Order Type', entityType: 'sale', type: 'text' },
      { key: 'order_status', name: 'Order Status', entityType: 'sale', type: 'text' },
    ],
  }),
}));

vi.mock('../lib/api', () => ({
  api: {
    listOrderAttributes,
  },
}));

vi.mock('../lib/i18n.jsx', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe('DynamicAttributes', () => {
  it('does not refetch endlessly when rerendered with the same hidden keys', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DynamicAttributes
        entityType="sale"
        attributes={{}}
        hiddenKeys={['order_status']}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(listOrderAttributes).toHaveBeenCalledTimes(1);
    });

    rerender(
      <DynamicAttributes
        entityType="sale"
        attributes={{ order_type: 'Dine In' }}
        hiddenKeys={['order_status']}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(listOrderAttributes).toHaveBeenCalledTimes(1);
    });
  });
});
