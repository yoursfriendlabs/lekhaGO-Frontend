import { describe, expect, it } from 'vitest';
import {
  canUseHotelApis,
  canUseRestaurantApis,
  hasRestaurantAddon,
  isHotelBusiness,
  resolveCanonicalBusinessType,
  showServiceChargeSettings,
} from './hospitality';

describe('hospitality gates', () => {
  it('maps lodge aliases to hotel without touching retail', () => {
    expect(resolveCanonicalBusinessType('retail')).toBe('retail');
    expect(resolveCanonicalBusinessType('cafe')).toBe('cafe');
    expect(resolveCanonicalBusinessType('lodge')).toBe('hotel');
    expect(resolveCanonicalBusinessType('Guest House')).toBe('hotel');
  });

  it('keeps Standard shops off restaurant and hotel APIs', () => {
    const retail = { type: 'retail', modules: { orders: false }, addons: [] };
    expect(hasRestaurantAddon(retail)).toBe(false);
    expect(canUseRestaurantApis(retail)).toBe(false);
    expect(isHotelBusiness(retail)).toBe(false);
    expect(canUseHotelApis(retail)).toBe(false);
    expect(showServiceChargeSettings(retail)).toBe(false);
  });

  it('enables restaurant when add-on or kitchen module is present', () => {
    expect(hasRestaurantAddon({ type: 'cafe', addons: ['restaurant'] })).toBe(true);
    expect(hasRestaurantAddon({ type: 'cafe', modules: { kitchen: true } })).toBe(true);
    expect(hasRestaurantAddon({ type: 'cafe', addons: [], modules: { orders: true } })).toBe(false);
  });

  it('treats hotel type and hotel module as hotel businesses', () => {
    expect(isHotelBusiness({ type: 'hotel' })).toBe(true);
    expect(isHotelBusiness({ type: 'retail', modules: { hotel: true } })).toBe(true);
    expect(showServiceChargeSettings({ type: 'cafe' })).toBe(true);
    expect(showServiceChargeSettings({ type: 'hotel' })).toBe(true);
  });
});
