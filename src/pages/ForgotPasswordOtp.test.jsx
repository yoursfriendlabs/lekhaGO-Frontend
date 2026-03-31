import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ForgotPasswordOtp from './ForgotPasswordOtp.jsx';
import { setPasswordResetFlow } from '../lib/storage';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const { requestPasswordReset, verifyPasswordResetOtp } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  verifyPasswordResetOtp: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    requestPasswordReset,
    verifyPasswordResetOtp,
  },
}));

describe('ForgotPasswordOtp', () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
    verifyPasswordResetOtp.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a clear message when the OTP is invalid', async () => {
    setPasswordResetFlow({ email: 'owner@example.com', code: '', resendAvailableAt: 0 });
    verifyPasswordResetOtp.mockRejectedValue({
      message: 'Invalid or expired code',
      status: 400,
      payload: { message: 'Invalid or expired code' },
    });
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/forgot-password/otp" element={<ForgotPasswordOtp />} />
      </Routes>,
      { route: '/forgot-password/otp' }
    );

    const [firstDigit] = screen.getAllByLabelText(/otp digit/i);
    await user.click(firstDigit);
    await user.paste('123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByText(/invalid or expired/i)).toBeInTheDocument();
  });

  it('shows the resend cooldown state while the timer is active', async () => {
    setPasswordResetFlow({
      email: 'owner@example.com',
      code: '',
      resendAvailableAt: Date.now() + 30_000,
    });

    renderWithProviders(
      <Routes>
        <Route path="/forgot-password/otp" element={<ForgotPasswordOtp />} />
      </Routes>,
      { route: '/forgot-password/otp' }
    );

    const resendButton = screen.getByRole('button', { name: /resend code/i });
    expect(resendButton).toBeDisabled();
    expect(screen.getByText(/resend the code after/i)).toBeInTheDocument();
  });
});
