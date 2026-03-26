export const OTP_LENGTH = 6;
export const RESEND_COOLDOWN_SECONDS = 30;
export const PASSWORD_MIN_LENGTH = 8;

const OTP_DIGIT_MAP = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const INVALID_OTP_REGEX = /(invalid|incorrect|wrong).*(otp|code)|(otp|code).*(invalid|incorrect|wrong)/i;
const EXPIRED_OTP_REGEX = /(expired|timeout).*(otp|code)|(otp|code).*(expired|timeout)/i;
const COOLDOWN_REGEX = /(too many requests|cooldown|wait before|try again later|resend.*later|rate limit)/i;
const WEAK_PASSWORD_REGEX =
  /(weak password|password (is )?too weak|password must|minimum password|at least .*character|include .*number|include .*uppercase|include .*lowercase)/i;
const CURRENT_PASSWORD_REGEX =
  /(current|old).*(password).*(invalid|incorrect|wrong)|(invalid|incorrect|wrong).*(current|old).*(password)/i;

function readErrorPayload(error) {
  return error?.payload && typeof error.payload === 'object' ? error.payload : {};
}

function readErrorMessage(error) {
  const payload = readErrorPayload(error);
  return String(payload.message || error?.message || '').trim();
}

function readErrorCode(error) {
  const payload = readErrorPayload(error);
  return String(payload.code || payload.errorCode || payload.error || '').trim().toUpperCase();
}

function readRetryAfterSeconds(error) {
  const payload = readErrorPayload(error);
  const rawValue =
    payload.retryAfterSeconds
    ?? payload.retryAfter
    ?? payload.retry_after
    ?? payload.data?.retryAfterSeconds
    ?? payload.data?.retryAfter;

  const seconds = Number(rawValue);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

function matchesCode(error, codes) {
  const errorCode = readErrorCode(error);
  return codes.includes(errorCode);
}

export function normalizeOtpDigits(rawValue) {
  return Array.from(String(rawValue || ''))
    .map((char) => OTP_DIGIT_MAP[char] || '')
    .join('');
}

export function getRemainingSeconds(resendAvailableAt) {
  if (!resendAvailableAt) return 0;
  const remainingMs = resendAvailableAt - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

export function normalizeEmail(value) {
  return String(value || '').trim();
}

export function validatePassword(password) {
  const value = String(password || '');
  const issues = [];

  if (value.length < PASSWORD_MIN_LENGTH) issues.push('length');
  if (!/[a-z]/.test(value)) issues.push('lowercase');
  if (!/[A-Z]/.test(value)) issues.push('uppercase');
  if (!/\d/.test(value)) issues.push('number');

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function getPasswordValidationMessage(password, t) {
  if (!password) return '';

  const { issues } = validatePassword(password);
  if (!issues.length) return '';
  if (issues.includes('length')) return t('auth.errors.passwordMinLength', { count: PASSWORD_MIN_LENGTH });
  if (issues.includes('uppercase')) return t('auth.errors.passwordUppercase');
  if (issues.includes('lowercase')) return t('auth.errors.passwordLowercase');
  if (issues.includes('number')) return t('auth.errors.passwordNumber');
  return t('auth.errors.weakPassword');
}

export function getPasswordMatchMessage(password, confirmPassword, t) {
  if (!confirmPassword) return '';
  if (password === confirmPassword) return '';
  return t('auth.errors.passwordMismatch');
}

export function resolveCooldownMessage(error, t) {
  const seconds = readRetryAfterSeconds(error);
  if (seconds > 0) return t('auth.errors.cooldownWithSeconds', { seconds });
  return t('auth.errors.cooldown');
}

export function resolveOtpErrorMessage(error, t) {
  const message = readErrorMessage(error);

  if (isExpiredOtpError(error, message)) return t('auth.errors.expiredOtp');
  if (isInvalidOtpError(error, message)) return t('auth.errors.invalidOtp');

  if (error?.status === 429 || matchesCode(error, ['TOO_MANY_REQUESTS', 'COOLDOWN_ACTIVE']) || COOLDOWN_REGEX.test(message)) {
    return resolveCooldownMessage(error, t);
  }

  return message || t('auth.errors.generic');
}

export function resolvePasswordErrorMessage(error, t) {
  const message = readErrorMessage(error);

  if (
    matchesCode(error, ['WEAK_PASSWORD', 'PASSWORD_TOO_WEAK', 'INVALID_PASSWORD'])
    || WEAK_PASSWORD_REGEX.test(message)
  ) {
    return t('auth.errors.weakPassword');
  }

  if (
    matchesCode(error, ['CURRENT_PASSWORD_INVALID', 'INVALID_CURRENT_PASSWORD'])
    || CURRENT_PASSWORD_REGEX.test(message)
  ) {
    return t('auth.errors.currentPasswordInvalid');
  }

  if (error?.status === 429 || matchesCode(error, ['TOO_MANY_REQUESTS', 'COOLDOWN_ACTIVE']) || COOLDOWN_REGEX.test(message)) {
    return resolveCooldownMessage(error, t);
  }

  return message || t('auth.errors.generic');
}

export function resolveAuthErrorMessage(error, t) {
  const message = readErrorMessage(error);

  if (error?.status === 429 || matchesCode(error, ['TOO_MANY_REQUESTS', 'COOLDOWN_ACTIVE']) || COOLDOWN_REGEX.test(message)) {
    return resolveCooldownMessage(error, t);
  }

  return message || t('auth.errors.generic');
}

export function hasUnverifiedEmail(user) {
  return user?.emailVerified === false;
}

export function isStaffActivationRequired(user, role) {
  return role === 'staff' && hasUnverifiedEmail(user);
}

export function isExpiredOtpError(error, message = readErrorMessage(error)) {
  return matchesCode(error, ['OTP_EXPIRED', 'EMAIL_OTP_EXPIRED', 'PASSWORD_RESET_OTP_EXPIRED', 'CODE_EXPIRED'])
    || EXPIRED_OTP_REGEX.test(message);
}

export function isInvalidOtpError(error, message = readErrorMessage(error)) {
  return matchesCode(error, ['OTP_INVALID', 'INVALID_OTP', 'EMAIL_OTP_INVALID', 'PASSWORD_RESET_OTP_INVALID', 'INVALID_CODE'])
    || INVALID_OTP_REGEX.test(message);
}

export function isOtpError(error, message = readErrorMessage(error)) {
  return isExpiredOtpError(error, message) || isInvalidOtpError(error, message);
}

export function resolveResetPasswordErrorMessage(error, t) {
  if (isOtpError(error)) return resolveOtpErrorMessage(error, t);
  return resolvePasswordErrorMessage(error, t);
}
