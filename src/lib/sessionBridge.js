// Cross-subdomain session bridge.
//
// The marketing site (pasalmanager.com) and the app (app.pasalmanager.com) are
// separate origins, so localStorage sessions do not carry across them. When a
// user signs in with a standard (non-demo) account on the marketing host we
// hand the freshly created session to the app host through a short-lived
// cookie scoped to the parent domain, then redirect. The app host adopts the
// session on boot and immediately clears the cookie.

const BRIDGE_COOKIE = "mms_session_bridge";
const DEMO_INTENT_KEY = "mms_demo_intent";
const BRIDGE_MAX_AGE_SECONDS = 120;

const DEFAULT_APP_ORIGIN = "https://app.pasalmanager.com";
const MARKETING_HOSTS = ["pasalmanager.com", "www.pasalmanager.com"];

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.document !== "undefined"
  );
}

export function getAppOrigin() {
  const configured = import.meta.env?.VITE_APP_ORIGIN;
  return (
    (typeof configured === "string" && configured.trim()) || DEFAULT_APP_ORIGIN
  );
}

export function isMarketingHost() {
  if (!isBrowser()) return false;
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  return MARKETING_HOSTS.includes(hostname.toLowerCase());
}

export function isAppHost() {
  if (!isBrowser()) return false;
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  const appHost = getAppOrigin();
  try {
    return new URL(appHost).hostname === hostname.toLowerCase();
  } catch {
    return false;
  }
}

export function setDemoIntent() {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(DEMO_INTENT_KEY, "1");
  } catch {
    // storage unavailable — demo intent simply cannot be remembered
  }
}

export function consumeDemoIntent() {
  if (!isBrowser()) return false;
  try {
    const value = localStorage.getItem(DEMO_INTENT_KEY) === "1";
    if (value) localStorage.removeItem(DEMO_INTENT_KEY);
    return value;
  } catch {
    return false;
  }
}

function readCookie(name) {
  const match = window.document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

function expireCookie(name) {
  window.document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function setBridgeSession(payload) {
  if (!isBrowser() || !payload?.token) return;
  try {
    window.document.cookie = [
      `${BRIDGE_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}`,
      "Path=/",
      "SameSite=Lax",
      "Secure",
      `Max-Age=${BRIDGE_MAX_AGE_SECONDS}`,
    ].join("; ");
  } catch {
    // If the cookie cannot be written the user will just sign in again on the
    // app host — never block login because of the bridge.
  }
}

export function consumeBridgeSession() {
  if (!isBrowser()) return null;
  const raw = readCookie(BRIDGE_COOKIE);
  if (!raw) return null;
  expireCookie(BRIDGE_COOKIE);
  try {
    const payload = JSON.parse(raw);
    return payload?.token ? payload : null;
  } catch {
    return null;
  }
}

export function buildAppRedirectPath(path = "/app") {
  const origin = getAppOrigin().replace(/\/+$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
