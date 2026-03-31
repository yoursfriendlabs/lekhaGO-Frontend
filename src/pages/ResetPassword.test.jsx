import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ResetPassword from './ResetPassword.jsx';
import { setPasswordResetFlow } from '../lib/storage';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const { resetPassword } = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    resetPassword,
  },
}));

describe('ResetPassword', () => {
  beforeEach(() => {
    resetPassword.mockReset();
    setPasswordResetFlow({ email: 'owner@example.com', code: '123456', verified: true });
  });

  it('requires OTP verification before showing the new-password form', async () => {
    setPasswordResetFlow({ email: 'owner@example.com', code: '123456', verified: false });

    renderWithProviders(
      <Routes>
        <Route path="/forgot-password/otp" element={<div>OTP step</div>} />
        <Route path="/forgot-password/reset" element={<ResetPassword />} />
      </Routes>,
      { route: '/forgot-password/reset' }
    );

    expect(await screen.findByText('OTP step')).toBeInTheDocument();
  });

  it('validates weak and mismatched passwords before submit', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/forgot-password/reset" element={<ResetPassword />} />
      </Routes>,
      { route: '/forgot-password/reset' }
    );

    await user.type(screen.getByLabelText(/^new password$/i), 'weak');
    expect(
      screen.getByText((content, element) => element?.id === 'reset-new-password-error' && /at least 8 characters/i.test(content))
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save new password/i })).toBeDisabled();

    await user.clear(screen.getByLabelText(/^new password$/i));
    await user.type(screen.getByLabelText(/^new password$/i), 'StrongPass1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'DifferentPass1');

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save new password/i })).toBeDisabled();
  });

  it('resets the password and shows a success state', async () => {
    resetPassword.mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/forgot-password/reset" element={<ResetPassword />} />
      </Routes>,
      { route: '/forgot-password/reset' }
    );

    await user.type(screen.getByLabelText(/^new password$/i), 'StrongPass1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: /save new password/i }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        email: 'owner@example.com',
        code: '123456',
        newPassword: 'StrongPass1',
      });
    });

    expect(await screen.findByRole('heading', { name: /password updated/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to login/i })).toBeInTheDocument();
    expect(window.sessionStorage.getItem('mms_password_reset_flow')).toBeNull();
  });
});
