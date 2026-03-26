const TOKEN_KEY = 'mms_token';
const USER_KEY = 'mms_user';
const BUSINESS_KEY = 'mms_business_id';
const ROLE_KEY = 'mms_role';
const SESSION_NOTICE_KEY = 'mms_session_notice';
const PENDING_EMAIL_VERIFICATION_KEY = 'mms_pending_email_verification';
const PASSWORD_RESET_FLOW_KEY = 'mms_password_reset_flow';

function getSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function getBusinessId() {
  return localStorage.getItem(BUSINESS_KEY) || '';
}

export function setBusinessId(id) {
  if (id) localStorage.setItem(BUSINESS_KEY, id);
  else localStorage.removeItem(BUSINESS_KEY);
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY) || getUser()?.role || '';
}

export function setRole(role) {
  if (role) localStorage.setItem(ROLE_KEY, role);
  else localStorage.removeItem(ROLE_KEY);
}

export function setSessionNotice(message) {
  if (message) localStorage.setItem(SESSION_NOTICE_KEY, message);
  else localStorage.removeItem(SESSION_NOTICE_KEY);
}

export function consumeSessionNotice() {
  const message = localStorage.getItem(SESSION_NOTICE_KEY) || '';
  localStorage.removeItem(SESSION_NOTICE_KEY);
  return message;
}

export function getPendingEmailVerification() {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(PENDING_EMAIL_VERIFICATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPendingEmailVerification(data) {
  const storage = getSessionStorage();
  if (!storage) return;

  if (!data) {
    storage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
    return;
  }

  storage.setItem(PENDING_EMAIL_VERIFICATION_KEY, JSON.stringify(data));
}

export function clearPendingEmailVerification() {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
}

export function getPasswordResetFlow() {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(PASSWORD_RESET_FLOW_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPasswordResetFlow(data) {
  const storage = getSessionStorage();
  if (!storage) return;

  if (!data) {
    storage.removeItem(PASSWORD_RESET_FLOW_KEY);
    return;
  }

  storage.setItem(PASSWORD_RESET_FLOW_KEY, JSON.stringify(data));
}

export function clearPasswordResetFlow() {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(PASSWORD_RESET_FLOW_KEY);
}

export function clearSession() {
  setToken('');
  setUser(null);
  setBusinessId('');
  setRole('');
  clearPendingEmailVerification();
}
