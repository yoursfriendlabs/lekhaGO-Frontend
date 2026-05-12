import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AsyncSearchableSelect from './AsyncSearchableSelect.jsx';

describe('AsyncSearchableSelect', () => {
  it('does not refetch options when the selected option prop is recreated with the same value', async () => {
    const loadOptions = vi.fn().mockResolvedValue([]);
    const onChange = vi.fn();
    const selectedOption = {
      value: 'product-1',
      label: 'Gold Ring · 22K',
    };

    const { rerender } = render(
      <AsyncSearchableSelect
        value="product-1"
        selectedOption={selectedOption}
        onChange={onChange}
        loadOptions={loadOptions}
        placeholder="Select product"
        searchPlaceholder="Search product"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /gold ring/i }));

    await act(async () => {
      await Promise.resolve();
    });

    rerender(
      <AsyncSearchableSelect
        value="product-1"
        selectedOption={{ ...selectedOption }}
        onChange={onChange}
        loadOptions={loadOptions}
        placeholder="Select product"
        searchPlaceholder="Search product"
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadOptions).toHaveBeenCalledTimes(1);
  });
});
