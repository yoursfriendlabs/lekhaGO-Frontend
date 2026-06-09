const TOKEN_KEY = 'mms_token';
const USER_KEY = 'mms_user';
const BUSINESS_KEY = 'mms_business_id';
const BUSINESS_DATA_KEY = 'mms_business';
const BUSINESS_PROFILE_KEY = 'mms_business_profile';
const ROLE_KEY = 'mms_role';
const SUBSCRIPTION_KEY = 'mms_subscription';
const ACCESS_CONTROL_KEY = 'mms_access_control';
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
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

export function getBusiness() {
  try {
    const raw = localStorage.getItem(BUSINESS_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setBusiness(business) {
  if (business) localStorage.setItem(BUSINESS_DATA_KEY, JSON.stringify(business));
  else localStorage.removeItem(BUSINESS_DATA_KEY);
}

export function getBusinessProfile() {
  try {
    const raw = localStorage.getItem(BUSINESS_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setBusinessProfile(profile) {
  if (profile) localStorage.setItem(BUSINESS_PROFILE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(BUSINESS_PROFILE_KEY);
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY) || getUser()?.role || '';
}

export function setRole(role) {
  if (role) localStorage.setItem(ROLE_KEY, role);
  else localStorage.removeItem(ROLE_KEY);
}

export function getSubscription() {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSubscription(subscription) {
  if (subscription) localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscription));
  else localStorage.removeItem(SUBSCRIPTION_KEY);
}

export function getAccessControl() {
  try {
    const raw = localStorage.getItem(ACCESS_CONTROL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAccessControl(accessControl) {
  if (accessControl) localStorage.setItem(ACCESS_CONTROL_KEY, JSON.stringify(accessControl));
  else localStorage.removeItem(ACCESS_CONTROL_KEY);
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
  setBusiness(null);
  setBusinessProfile(null);
  setRole('');
  setSubscription(null);
  setAccessControl(null);
  clearPendingEmailVerification();
}
