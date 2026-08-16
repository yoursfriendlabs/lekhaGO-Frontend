import { describe, expect, it } from 'vitest';
import {
  adISOToBsParts,
  bsPartsToAdISO,
  formatDateBoth,
  getBsDaysInMonth,
  isValidAdISODate,
  todayAdISO,
  todayBsParts,
} from './nepaliDate';

describe('nepaliDate conversion', () => {
  it('validates AD ISO dates', () => {
    expect(isValidAdISODate('2026-08-10')).toBe(true);
    expect(isValidAdISODate('2026-13-10')).toBe(false);
    expect(isValidAdISODate('2083-04-25')).toBe(true); // format-valid, conversion may still succeed as AD year
  });

  it('reads 31-day Nepali months from the converter calendar, not a 30-day fallback', () => {
    expect(getBsDaysInMonth(2083, 4)).toBe(31); // Shrawan 2083
    expect(getBsDaysInMonth(2083, 3)).toBe(32); // Asar 2083
  });

  it('accepts the last day of a 31-day Nepali month', () => {
    const adISO = bsPartsToAdISO(2083, 4, 31);
    expect(adISO).toBe('2026-08-16');

    const bs = adISOToBsParts(adISO);
    expect(bs).toEqual({ year: 2083, month: 4, day: 31 });
  });

  it('converts today in both calendars without rejecting it as invalid', () => {
    const todayBs = todayBsParts();
    const converted = bsPartsToAdISO(todayBs.year, todayBs.month, todayBs.day);
    expect(converted).toBe(todayAdISO());

    const roundTrip = adISOToBsParts(converted);
    expect(roundTrip).toEqual(todayBs);
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
    expect(formatted).toContain('2083-04-25');
  });
});
