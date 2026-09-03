import { describe, expect, it } from 'vitest';
import {
  findWorkspace,
  normalizeWorkspace,
  normalizeWorkspacePayload,
  pickWorkspaceFields,
  resolveWorkspaceCreationOptions,
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

  it('allows one owned personal and one owned business workspace', () => {
    expect(resolveWorkspaceCreationOptions([
      { isOwner: true, isPersonal: true },
      { isOwner: true, isPersonal: false },
    ])).toMatchObject({
      canCreateWorkspace: false,
      canCreateBusiness: false,
      canCreatePersonal: false,
    });

    expect(resolveWorkspaceCreationOptions([
      { isOwner: true, isPersonal: true },
    ])).toMatchObject({
      canCreateWorkspace: true,
      canCreateBusiness: true,
      canCreatePersonal: false,
      creatableWorkspaceTypes: ['retail', 'cafe'],
    });

    expect(resolveWorkspaceCreationOptions([
      { isOwner: true, isPersonal: false },
    ])).toMatchObject({
      canCreateWorkspace: true,
      canCreateBusiness: false,
      canCreatePersonal: true,
      creatableWorkspaceTypes: ['personal'],
    });
  });

  it('ignores staff memberships when deciding what can be created', () => {
    const payload = normalizeWorkspacePayload({
      businesses: [
        { id: 'biz-1', name: 'Home', type: 'personal', role: 'owner' },
        { id: 'biz-2', name: 'Shop', type: 'retail', role: 'staff' },
      ],
    });

    expect(payload.canCreateBusiness).toBe(true);
    expect(payload.canCreatePersonal).toBe(false);
    expect(payload.creatableWorkspaceTypes).toEqual(['retail', 'cafe']);
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
