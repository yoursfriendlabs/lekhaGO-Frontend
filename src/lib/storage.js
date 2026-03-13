const TOKEN_KEY = 'mms_token';
const USER_KEY = 'mms_user';
const BUSINESS_KEY = 'mms_business_id';

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

export function clearSession() {
  setToken('');
  setUser(null);
  setBusinessId('');
}
