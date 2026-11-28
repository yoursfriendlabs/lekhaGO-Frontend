import { describe, expect, it } from 'vitest';
import { isRouteActive, pickPrimaryTabs } from './mobileTabs.js';

describe('pickPrimaryTabs', () => {
  it('keeps the business order, caps at four and leaves settings and profile for More', () => {
    const items = [
      { key: 'settings', route: '/app/settings' },
      { key: 'dashboard', route: '/app' },
      { key: 'profile', route: '/app/profile' },
      { key: 'quickPos', route: '/app/pos' },
      { key: 'inventory', route: '/app/inventory' },
      { key: 'parties', route: '/app/parties' },
      { key: 'reports', route: '/app/reports' },
    ];
    expect(pickPrimaryTabs(items).map((item) => item.key)).toEqual(['dashboard', 'quickPos', 'inventory', 'parties']);
  });
});

describe('isRouteActive', () => {
  it('matches the dashboard only exactly and other routes by prefix', () => {
    expect(isRouteActive('/app', '/app')).toBe(true);
    expect(isRouteActive('/app/sales', '/app')).toBe(false);
    expect(isRouteActive('/app/hotel/rooms', '/app/hotel')).toBe(true);
    expect(isRouteActive('/app/hotelx', '/app/hotel')).toBe(false);
    expect(isRouteActive('/app/reports', '/app/reports?tab=party')).toBe(true);
  });
});
