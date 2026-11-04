import { describe, expect, it } from 'vitest';
import { formatTaxLabel, getBillTaxRate } from './taxLabel';

describe('bill tax label', () => {
  it('uses the rate set on the bill', () => {
    expect(getBillTaxRate({ taxRate: 13, SaleItems: [{ taxRate: 0 }] })).toBe(13);
  });

  it('uses the line rate when every taxed line shares it', () => {
    expect(getBillTaxRate({ SaleItems: [{ taxRate: 13 }, { taxRate: 0 }, { taxRate: '13' }] })).toBe(13);
  });

  it('shows no rate when lines are taxed differently', () => {
    expect(getBillTaxRate({}, [{ taxRate: 5 }, { taxRate: 13 }])).toBe(0);
  });

  it('writes the label', () => {
    expect(formatTaxLabel(13)).toBe('Tax (13%)');
    expect(formatTaxLabel(12.5, 'VAT')).toBe('VAT (12.5%)');
    expect(formatTaxLabel(0)).toBe('Tax');
  });
});
