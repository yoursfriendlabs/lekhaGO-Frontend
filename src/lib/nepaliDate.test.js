import { describe, expect, it } from 'vitest';
import {
  adISOToBsParts,
  bsPartsToAdISO,
  formatDateBoth,
  isValidAdISODate,
} from './nepaliDate';

describe('nepaliDate conversion', () => {
  it('validates AD ISO dates', () => {
    expect(isValidAdISODate('2026-08-10')).toBe(true);
    expect(isValidAdISODate('2026-13-10')).toBe(false);
    expect(isValidAdISODate('2083-04-25')).toBe(true); // format-valid, conversion may still succeed as AD year
  });

  it('converts BS parts to AD ISO and back', () => {
    const adISO = bsPartsToAdISO(2083, 4, 25);
    expect(adISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const bs = adISOToBsParts(adISO);
    expect(bs).toEqual({ year: 2083, month: 4, day: 25 });
  });

  it('formats both calendars for display', () => {
    const adISO = bsPartsToAdISO(2083, 4, 25);
    const formatted = formatDateBoth(adISO);
    expect(formatted).toContain(adISO);
    expect(formatted).toContain('BS 2083-04-25');
  });
});
