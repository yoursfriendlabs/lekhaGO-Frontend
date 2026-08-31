import { describe, expect, it } from 'vitest';
import { getDefaultBusinessProfile, normalizeBusinessProfile } from './businessProfile';

describe('businessProfile helpers', () => {
  it('keeps retail services enabled and visible in navigation', () => {
    const profile = getDefaultBusinessProfile('retail');

    expect(profile.type).toBe('retail');
    expect(profile.modules.services).toBe(true);
    expect(profile.servicesFlow.enabled).toBe(true);
    expect(profile.navigation.some((item) => item.key === 'services' && item.route === '/app/services')).toBe(true);
    expect(profile.settings.enabledModules).toContain('services');
  });

  it('returns cafe defaults with orders and POS navigation', () => {
    const profile = getDefaultBusinessProfile('cafe');

    expect(profile.type).toBe('cafe');
    expect(profile.navigation.some((item) => item.key === 'orders' && item.route === '/app/orders')).toBe(true);
    expect(profile.salesFlow.navLabel).toBe('POS');
    expect(profile.salesFlow.route).toBe('/app/pos');
  });

  it('merges server overrides on top of the business type defaults', () => {
    const profile = normalizeBusinessProfile({
      type: 'jewellery',
      settings: {
        defaultOrderChannel: 'appointment',
      },
    });

    expect(profile.inventory.showJewelleryFields).toBe(true);
    expect(profile.servicesFlow.enabled).toBe(true);
    expect(profile.settings.defaultOrderChannel).toBe('appointment');
  });
});
