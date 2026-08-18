import { describe, expect, it } from 'vitest';
import {
  applyPermissionChange,
  enforcePermissionDependencies,
  getFeatureAccessLevel,
  getStaffPermissionUiFeatures,
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

  it('auto-grants inventory view when sales, services, or purchases access is given', () => {
    const withSales = applyPermissionChange({}, 'sales', 'manage');
    expect(withSales.sales).toBe('manage');
    expect(withSales.inventory).toBe('view');

    const withQuickPos = applyPermissionChange({}, 'quickPos', 'manage');
    expect(withQuickPos.quickPos).toBe('manage');
    expect(withQuickPos.inventory).toBe('view');

    const withServices = applyPermissionChange({}, 'services', 'view');
    expect(withServices.services).toBe('view');
    expect(withServices.inventory).toBe('view');

    const withPurchases = applyPermissionChange({}, 'purchases', 'manage');
    expect(withPurchases.purchases).toBe('manage');
    expect(withPurchases.inventory).toBe('view');
  });

  it('clears sales/pos/services/purchases when inventory view is removed', () => {
    const next = applyPermissionChange(
      {
        inventory: 'view',
        sales: 'manage',
        services: 'view',
        purchases: 'manage',
        orders: 'manage',
        billing: 'view',
      },
      'inventory',
      'none'
    );

    expect(next.inventory).toBe('none');
    expect(next.sales).toBe('none');
    expect(next.quickPos).toBe('none');
    expect(next.services).toBe('none');
    expect(next.purchases).toBe('none');
    expect(next.orders).toBe('none');
    expect(next.billing).toBe('none');
  });

  it('shows standard permission rows with reports instead of analytics/tables', () => {
    const features = getStaffPermissionUiFeatures([
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'inventory', label: 'Inventory' },
      { key: 'sales', label: 'Sales' },
      { key: 'quickPos', label: 'Quick POS' },
      { key: 'purchasePrice', label: 'Purchase price' },
      { key: 'analytics', label: 'Analytics' },
      { key: 'tables', label: 'Tables' },
      { key: 'orders', label: 'Orders' },
      { key: 'billing', label: 'Billing' },
      { key: 'reports', label: 'Reports' },
    ]);

    const keys = features.map((feature) => feature.key);
    expect(keys).toContain('reports');
    expect(keys).toContain('sales');
    expect(keys).toContain('quickPos');
    expect(keys).toContain('purchasePrice');
    expect(keys).not.toContain('analytics');
    expect(keys).not.toContain('tables');
    expect(keys).not.toContain('orders');
    expect(keys).not.toContain('billing');
    expect(keys.filter((key) => key === 'reports')).toHaveLength(1);
  });

  it('inherits Quick POS from legacy sales manage without exposing purchase price', () => {
    const accessControl = normalizeAccessControl({
      role: 'staff',
      permissions: {
        sales: 'manage',
        dashboard: 'view',
      },
    });

    expect(getFeatureAccessLevel(accessControl, 'quickPos', 'staff')).toBe('manage');
    expect(getFeatureAccessLevel(accessControl, 'purchasePrice', 'staff')).toBe('none');
    expect(getFeatureAccessLevel(accessControl, 'inventory', 'staff')).toBe('view');
  });

  it('blocks sales and services access at runtime without inventory view', () => {
    const accessControl = normalizeAccessControl({
      role: 'staff',
      permissions: {
        sales: 'manage',
        services: 'view',
        inventory: 'none',
      },
    });

    // normalizeAccessControl enforces inventory view when dependents exist
    expect(accessControl.permissions.inventory).toBe('view');
    expect(getFeatureAccessLevel(accessControl, 'sales', 'staff')).toBe('manage');

    const rawBlocked = {
      role: 'staff',
      permissions: {
        sales: 'manage',
        services: 'view',
        inventory: 'none',
      },
    };
    expect(getFeatureAccessLevel(rawBlocked, 'sales', 'staff')).toBe('none');
    expect(getFeatureAccessLevel(rawBlocked, 'services', 'staff')).toBe('none');
    expect(enforcePermissionDependencies(rawBlocked.permissions).inventory).toBe('view');
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
