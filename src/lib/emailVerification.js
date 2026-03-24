const VERIFICATION_REQUIRED_REGEX =
  /(verification required|verify( your)? email|email (is )?not verified|email verification required)/i;

export function isEmailVerificationRequiredError(error) {
  const message = error?.payload?.message || error?.message || '';
  const code = String(error?.payload?.code || error?.payload?.errorCode || '').toUpperCase();

  return Boolean(
    error?.payload?.verificationRequired
    || error?.payload?.requiresVerification
    || code === 'EMAIL_VERIFICATION_REQUIRED'
    || VERIFICATION_REQUIRED_REGEX.test(message)
  );
}

export function getVerificationEmail(error, fallbackEmail = '') {
  return (
    error?.payload?.email
    || error?.payload?.user?.email
    || error?.payload?.data?.email
    || fallbackEmail
    || ''
  );
}
