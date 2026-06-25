import { describe, expect, it } from 'vitest';
import { buildPaymentPayload } from './payments.js';

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
});
