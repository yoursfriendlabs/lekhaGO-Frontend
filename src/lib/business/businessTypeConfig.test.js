import { describe, expect, it } from 'vitest';
import { getNavigationForBusinessType } from './businessTypeConfig';

describe('personal workspace navigation', () => {
  it('keeps personal finance tools and does not add team-only pages', () => {
    const navigation = getNavigationForBusinessType([
      { key: 'dashboard', route: '/app' },
      { key: 'parties', route: '/app/parties' },
      { key: 'purchases', route: '/app/purchases' },
      { key: 'budgets', route: '/app/budgets' },
      { key: 'tasks', route: '/app/tasks' },
      { key: 'analytics', route: '/app/analytics' },
      { key: 'settings', route: '/app/settings' },
    ], { type: 'personal' });

    const keys = navigation.map((item) => item.key);
    expect(keys).toContain('budgets');
    expect(keys).not.toContain('attendance');
    expect(keys).not.toContain('staff');
  });
});
