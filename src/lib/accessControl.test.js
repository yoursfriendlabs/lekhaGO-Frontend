import { describe, expect, it } from 'vitest';
import {
  getFeatureAccessLevel,
  normalizeAccessControl,
} from './accessControl';
import {
  getCategoryPermissions,
  normalizeStaffCollection,
} from './staff';

describe('access control helpers', () => {
  it('keeps owners fully accessible even when access control has empty permissions', () => {
    const accessControl = normalizeAccessControl({
      role: 'owner',
      permissions: {},
    });

    expect(getFeatureAccessLevel(accessControl, 'dashboard', 'owner')).toBe('manage');
    expect(getFeatureAccessLevel(accessControl, 'inventory', 'owner')).toBe('manage');
    expect(getFeatureAccessLevel(accessControl, 'settings', 'owner')).toBe('manage');
  });

  it('maps frontend features to backend permissions and preserves view/manage levels', () => {
    const accessControl = normalizeAccessControl({
      role: 'staff',
      permissions: {
        inventory: 'view',
        reports: 'manage',
      },
    });

    expect(getFeatureAccessLevel(accessControl, 'inventory', 'staff')).toBe('view');
    expect(getFeatureAccessLevel(accessControl, 'ledger', 'staff')).toBe('manage');
    expect(getFeatureAccessLevel(accessControl, 'sales', 'staff')).toBe('none');
  });

  it('normalizes staff meta and category default permissions from backend payloads', () => {
    const collection = normalizeStaffCollection({
      summary: {
        maxUsers: 5,
        totalUsers: 2,
        availableSlots: 3,
      },
      meta: {
        accessLevels: [{ key: 'none' }, { key: 'view' }, { key: 'manage' }],
        features: [{ key: 'sales', label: 'Sales', description: 'Billing and invoices' }],
        categories: [
          {
            key: 'cashier',
            label: 'Cashier',
            description: 'Counter team',
            defaultPermissions: {
              sales: 'manage',
              reports: 'view',
            },
          },
        ],
      },
      members: [
        {
          membershipId: 'member-1',
          role: 'staff',
          staffCategory: 'cashier',
          permissions: {
            sales: 'manage',
            reports: 'view',
          },
          user: {
            id: 'user-1',
            name: 'Counter User',
            email: 'counter@example.com',
            isActive: true,
            emailVerified: true,
          },
        },
      ],
    });

    expect(collection.summary.availableSlots).toBe(3);
    expect(collection.meta.features[0].label).toBe('Sales');
    expect(getCategoryPermissions(collection.meta, 'cashier').sales).toBe('manage');
    expect(collection.members[0].category.label).toBe('Cashier');
    expect(collection.members[0].permissions.reports).toBe('view');
  });
});
