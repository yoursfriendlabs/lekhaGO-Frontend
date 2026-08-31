import { describe, expect, it } from 'vitest';
import { buildPaymentPayload, getEffectivePaymentMethod, normalizePaymentFields } from './payments.js';

describe('getEffectivePaymentMethod', () => {
  it('respects explicit cash payment method even if bankId is present', () => {
    expect(getEffectivePaymentMethod('cash', 'bank-123')).toBe('cash');
  });

  it('respects explicit bank payment method', () => {
    expect(getEffectivePaymentMethod('bank', 'bank-123')).toBe('bank');
    expect(getEffectivePaymentMethod('bank', '')).toBe('bank');
  });

  it('falls back to bank if bankId is present without explicit cash', () => {
    expect(getEffectivePaymentMethod('', 'bank-123')).toBe('bank');
    expect(getEffectivePaymentMethod(null, 'bank-123')).toBe('bank');
  });

  it('defaults to cash if no method and no bankId', () => {
    expect(getEffectivePaymentMethod('', '')).toBe('cash');
  });
});

describe('normalizePaymentFields', () => {
  it('clears bankId when paymentMethod is cash', () => {
    expect(normalizePaymentFields({ paymentMethod: 'cash', bankId: 'bank-123' })).toEqual({
      paymentMethod: 'cash',
      bankId: '',
      paymentNote: '',
    });
  });

  it('keeps bankId when paymentMethod is bank', () => {
    expect(normalizePaymentFields({ paymentMethod: 'bank', bankId: 'bank-123' })).toEqual({
      paymentMethod: 'bank',
      bankId: 'bank-123',
      paymentNote: '',
    });
  });
});

describe('buildPaymentPayload', () => {
  it('omits an empty bank id by default', () => {
    expect(buildPaymentPayload({ paymentMethod: 'cash', bankId: '' })).toEqual({
      paymentMethod: 'cash',
    });
  });

  it('can include a null bank id to clear existing bank payments', () => {
    expect(
      buildPaymentPayload(
        { paymentMethod: 'cash', bankId: '' },
        { includeEmptyBankId: true },
      ),
    ).toEqual({
      paymentMethod: 'cash',
      bankId: null,
    });
  });

  it('preserves bankId when paymentMethod is bank even if received amount is 0 (due)', () => {
    expect(
      buildPaymentPayload(
        { paymentMethod: 'bank', bankId: 'bank-123' },
        { includeEmptyBankId: true },
      ),
    ).toEqual({
      paymentMethod: 'bank',
      bankId: 'bank-123',
    });
  });
});
