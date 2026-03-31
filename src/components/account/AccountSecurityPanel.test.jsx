import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AccountSecurityPanel from './AccountSecurityPanel.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';

const { changePassword } = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    changePassword,
  },
}));

function seedAuthenticatedUser(overrides = {}) {
  window.localStorage.setItem('mms_token', 'token-123');
  window.localStorage.setItem('mms_role', overrides.role || 'owner');
  window.localStorage.setItem('mms_user', JSON.stringify({
    id: 'user-1',
    name: 'Owner',
    email: 'owner@example.com',
    emailVerified: true,
    role: 'owner',
    ...overrides,
  }));
}

describe('AccountSecurityPanel', () => {
  beforeEach(() => {
    changePassword.mockReset();
    seedAuthenticatedUser();
  });

  it('changes the password successfully for a signed-in user', async () => {
    changePassword.mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<AccountSecurityPanel />, { route: '/app/settings', withAuth: true });

    await user.type(screen.getByLabelText(/current password/i), 'CurrentPass1');
    await user.type(screen.getByLabelText(/^new password$/i), 'StrongPass1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'CurrentPass1',
        newPassword: 'StrongPass1',
      });
    });

    expect(await screen.findByText(/password changed successfully/i)).toBeInTheDocument();
  });

  it('maps current-password failures to a clear error message', async () => {
    changePassword.mockRejectedValue({
      message: 'Current password is incorrect',
      payload: { code: 'CURRENT_PASSWORD_INVALID' },
    });
    const user = userEvent.setup();

    renderWithProviders(<AccountSecurityPanel />, { route: '/app/settings', withAuth: true });

    await user.type(screen.getByLabelText(/current password/i), 'WrongPass1');
    await user.type(screen.getByLabelText(/^new password$/i), 'StrongPass1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
  });

  it('prevents reusing the current password on the client', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AccountSecurityPanel />, { route: '/app/settings', withAuth: true });

    await user.type(screen.getByLabelText(/current password/i), 'SamePass1');
    await user.type(screen.getByLabelText(/^new password$/i), 'SamePass1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'SamePass1');

    expect(screen.getByText(/different from your current password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeDisabled();
  });
});
