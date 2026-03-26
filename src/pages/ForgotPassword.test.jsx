import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ForgotPassword from './ForgotPassword.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    requestPasswordReset,
  },
}));

describe('ForgotPassword', () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
  });

  it('requests a reset code and navigates to the OTP step', async () => {
    requestPasswordReset.mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot-password/otp" element={<div>OTP step</div>} />
      </Routes>,
      { route: '/forgot-password' }
    );

    await user.type(screen.getByLabelText(/email address/i), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'owner@example.com' });
    });

    expect(await screen.findByText('OTP step')).toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem('mms_password_reset_flow'))).toMatchObject({
      email: 'owner@example.com',
    });
  });
});
