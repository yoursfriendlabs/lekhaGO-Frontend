import { describe, expect, it } from 'vitest';
import {
  findWorkspace,
  normalizeWorkspace,
  normalizeWorkspacePayload,
  pickWorkspaceFields,
  sortWorkspaces,
} from './workspaces';

describe('workspace helpers', () => {
  it('maps API membership rows into the switcher shape', () => {
    expect(normalizeWorkspace({
      id: 'biz-1',
      businessId: 'biz-1',
      membershipId: 'mem-1',
      name: 'Home ledger',
      type: 'household',
      label: 'Personal',
      role: 'owner',
      isOwner: true,
      isPersonal: true,
      isActive: true,
    })).toEqual({
      id: 'biz-1',
      businessId: 'biz-1',
      membershipId: 'mem-1',
      name: 'Home ledger',
      type: 'household',
      label: 'Personal',
      role: 'owner',
      isOwner: true,
      isPersonal: true,
      isActive: true,
    });
  });

  it('sorts personal first, then owned shops, then staff invites', () => {
    const items = sortWorkspaces([
      { id: 'staff', name: 'Invited cafe', isPersonal: false, isOwner: false },
      { id: 'shop', name: 'Corner store', isPersonal: false, isOwner: true },
      { id: 'home', name: 'Home', isPersonal: true, isOwner: true },
    ]);

    expect(items.map((item) => item.id)).toEqual(['home', 'shop', 'staff']);
  });

  it('reads items or businesses from auth payloads', () => {
    const payload = normalizeWorkspacePayload({
      businesses: [
        { id: 'biz-1', name: 'Home', type: 'personal', role: 'owner' },
        { id: 'biz-2', name: 'Shop', type: 'retail', role: 'staff' },
      ],
      canCreateBusiness: true,
      extraBusinessTypes: ['retail', 'cafe'],
    });

    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].isPersonal).toBe(true);
    expect(payload.items[1].isOwner).toBe(false);
    expect(payload.canCreateBusiness).toBe(true);
  });

  it('ignores payloads that do not include workspace fields', () => {
    expect(pickWorkspaceFields({ token: 'abc', user: { id: '1' } })).toBeNull();
    expect(pickWorkspaceFields({ items: [] })?.items).toEqual([]);
  });

  it('finds the active workspace by id', () => {
    const items = [{ id: 'biz-2', businessId: 'biz-2', name: 'Shop' }];
    expect(findWorkspace(items, 'biz-2')?.name).toBe('Shop');
    expect(findWorkspace(items, 'missing')).toBeNull();
  });
});
