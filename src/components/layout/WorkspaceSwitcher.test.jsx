import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n.jsx';

const authState = {
  user: { name: 'Dipesh' },
  businessId: 'biz-home',
  business: { id: 'biz-home', name: 'Home ledger' },
  workspaces: [
    {
      id: 'biz-home',
      businessId: 'biz-home',
      name: 'Home ledger',
      type: 'personal',
      label: 'Personal',
      role: 'owner',
      isOwner: true,
      isPersonal: true,
    },
    {
      id: 'biz-shop',
      businessId: 'biz-shop',
      name: 'Corner store',
      type: 'retail',
      label: 'Retail',
      role: 'staff',
      isOwner: false,
      isPersonal: false,
    },
  ],
  canCreateBusiness: true,
  extraBusinessTypes: ['retail', 'cafe'],
  workspaceBusy: false,
  refreshWorkspaces: vi.fn(async () => authState.workspaces),
  switchWorkspace: vi.fn(async () => ({ businessId: 'biz-shop' })),
  createWorkspace: vi.fn(),
};

vi.mock('../../lib/auth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../lib/business/businessSettings.jsx', () => ({
  useBusinessSettings: () => ({ businessProfile: { label: 'Personal' } }),
}));

import WorkspaceSwitcher from './WorkspaceSwitcher.jsx';

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    authState.switchWorkspace.mockClear();
    authState.refreshWorkspaces.mockClear();
  });

  it('lists personal, owned, and staff workspaces and switches on click', async () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <WorkspaceSwitcher />
        </I18nProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /switch workspace/i }));

    expect(screen.getAllByText('Home ledger').length).toBeGreaterThan(0);
    expect(screen.getByText('Corner store')).toBeInTheDocument();
    expect(screen.getByText(/retail · staff/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add a business/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /corner store/i }));
    expect(authState.switchWorkspace).toHaveBeenCalledWith('biz-shop');
  });
});
