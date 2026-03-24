import { clearSession, getBusinessId, getToken, setSessionNotice } from './storage';
import { toQueryKey, toQueryString } from './queryKey';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.yoursfriend.com';

const INACTIVE_USER_REGEX = /user is inactive/i;
const responseCache = new Map();
const inflightRequests = new Map();
const tagIndex = new Map();

const CACHE_TTL = {
  short: 15_000,
  detail: 45_000,
  list: 60_000,
  lookup: 5 * 60_000,
  settings: 5 * 60_000,
  report: 45_000,
};

function uniqueTags(tags = []) {
  return [...new Set(tags.filter(Boolean))];
}

function isApiDebugEnabled() {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem('mms_debug_api') === '1';
  } catch {
    return false;
  }
}

function logApiEvent(label, meta = {}) {
  if (!isApiDebugEnabled()) return;

  const details = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

  console.info(`[api] ${label}${details ? ` ${details}` : ''}`);
}

function clonePayload(payload) {
  if (payload === undefined) return payload;
  if (typeof structuredClone === 'function') return structuredClone(payload);
  return JSON.parse(JSON.stringify(payload));
}

function readCache(cacheKey, ttlMs) {
  const entry = responseCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > ttlMs) {
    untrackCacheKey(cacheKey);
    return null;
  }

  return clonePayload(entry.payload);
}

function trackCacheEntry(cacheKey, tags, payload) {
  const normalizedTags = uniqueTags(tags);

  if (responseCache.has(cacheKey)) {
    untrackCacheKey(cacheKey);
  }

  responseCache.set(cacheKey, {
    payload,
    tags: normalizedTags,
    timestamp: Date.now(),
  });

  normalizedTags.forEach((tag) => {
    const existing = tagIndex.get(tag) || new Set();
    existing.add(cacheKey);
    tagIndex.set(tag, existing);
  });
}

function untrackCacheKey(cacheKey) {
  const entry = responseCache.get(cacheKey);
  if (!entry) return;

  entry.tags.forEach((tag) => {
    const keys = tagIndex.get(tag);
    if (!keys) return;
    keys.delete(cacheKey);
    if (keys.size === 0) {
      tagIndex.delete(tag);
    }
  });

  responseCache.delete(cacheKey);
}

export function invalidateApiCache(tags = []) {
  uniqueTags(Array.isArray(tags) ? tags : [tags]).forEach((tag) => {
    const keys = tagIndex.get(tag);
    if (!keys) return;
    [...keys].forEach((cacheKey) => untrackCacheKey(cacheKey));
  });
}

export function clearApiCache() {
  responseCache.clear();
  inflightRequests.clear();
  tagIndex.clear();
}

export function getApiCacheSnapshot() {
  return {
    entries: responseCache.size,
    inflight: inflightRequests.size,
    tags: [...tagIndex.entries()].map(([tag, keys]) => ({ tag, entries: keys.size })),
  };
}

function handleInactiveUser(message) {
  clearApiCache();
  clearSession();
  setSessionNotice(message);

  if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
    window.location.replace('/login');
  }
}

function buildRequestUrl(path) {
  return `${API_BASE}${path}`;
}

function buildCacheKey(method, path, businessId) {
  return `${method}:${businessId || 'default'}:${path}`;
}

async function request(path, options = {}, config = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const token = getToken();
  const businessId = getBusinessId();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (businessId) headers['x-business-id'] = businessId;
  if (headers['Content-Type'] === '') delete headers['Content-Type'];

  const cacheConfig = {
    enabled: method === 'GET',
    ttlMs: 0,
    tags: [],
    mode: 'default',
    ...(config.cache || {}),
  };

  const url = buildRequestUrl(path);
  const cacheKey = buildCacheKey(method, path, businessId);
  const startedAt = Date.now();

  if (cacheConfig.enabled && cacheConfig.ttlMs > 0 && cacheConfig.mode !== 'force') {
    const cached = readCache(cacheKey, cacheConfig.ttlMs);
    if (cached !== null) {
      logApiEvent('cache-hit', { method, path });
      return cached;
    }
  }

  if (cacheConfig.enabled && inflightRequests.has(cacheKey)) {
    logApiEvent('dedupe', { method, path });
    return inflightRequests.get(cacheKey);
  }

  logApiEvent('request', { method, path, mode: cacheConfig.enabled ? cacheConfig.mode : 'network' });

  const promise = fetch(url, {
    ...options,
    headers,
  })
    .then(async (res) => {
      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : null;

      if (!res.ok) {
        const message = payload?.message || 'Request failed';
        const error = new Error(message);
        error.status = res.status;
        error.payload = payload;
        error.meta = {
          method,
          path,
          businessId,
        };

        if (res.status === 403 && INACTIVE_USER_REGEX.test(message)) {
          error.inactiveUser = true;
          handleInactiveUser(message);
        }

        throw error;
      }

      if (cacheConfig.enabled && cacheConfig.ttlMs > 0) {
        trackCacheEntry(cacheKey, cacheConfig.tags, clonePayload(payload));
      } else if (config.invalidateTags?.length) {
        invalidateApiCache(config.invalidateTags);
      }

      logApiEvent('response', {
        method,
        path,
        status: res.status,
        durationMs: Date.now() - startedAt,
      });

      return payload;
    })
    .catch((error) => {
      logApiEvent('error', {
        method,
        path,
        status: error?.status || 'network',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  if (cacheConfig.enabled) {
    inflightRequests.set(cacheKey, promise);
  }

  return promise;
}

function buildListPath(path, params = {}) {
  const query = toQueryString(params);
  return query ? `${path}?${query}` : path;
}

function listRequest(path, params = {}, config = {}) {
  return request(buildListPath(path, params), {}, config);
}

function pickFirstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function normalizeCollectionResponse(payload, options = {}) {
  const {
    itemKeys = ['items', 'rows', 'data', 'results', 'parties'],
    totalFallback,
  } = options;

  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      limit: payload.length,
      offset: 0,
    };
  }

  const objectPayload = payload && typeof payload === 'object' ? payload : {};
  const items = pickFirstArray(
    ...itemKeys.map((key) => objectPayload?.[key])
  );
  const total = Number(
    objectPayload.total
    ?? objectPayload.count
    ?? objectPayload.totalCount
    ?? objectPayload.summary?.totalRows
    ?? totalFallback
    ?? items.length
  );
  const limit = Number(
    objectPayload.limit
    ?? objectPayload.pagination?.limit
    ?? items.length
  );
  const offset = Number(
    objectPayload.offset
    ?? objectPayload.pagination?.offset
    ?? 0
  );

  return {
    ...objectPayload,
    items,
    total,
    limit,
    offset,
  };
}

export function getCollectionItems(payload, options) {
  return normalizeCollectionResponse(payload, options).items;
}

function collectionRequest(path, params = {}, config = {}, options = {}) {
  return listRequest(path, params, config).then((payload) => normalizeCollectionResponse(payload, options));
}

function detailTags(resource, id) {
  return uniqueTags([resource, `${resource}:${id}`]);
}

function listCache(tags, ttlMs = CACHE_TTL.list) {
  return { cache: { ttlMs, tags } };
}

function mutationConfig(...tags) {
  return { invalidateTags: uniqueTags(tags.flat()) };
}

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const keys = [
    'data',
    'items',
    'results',
    'rows',
    'list',
    'records',
    'docs',
    'products',
    'sales',
    'purchases',
    'services',
    'parties',
    'staff',
    'transactions',
    'orderAttributes',
    'order_attributes',
  ];

  const findArray = (value, depth) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return null;
    if (depth >= 3) return null;
    for (const key of keys) {
      const found = findArray(value[key], depth + 1);
      if (found) return found;
    }
    return null;
  };

  return findArray(payload, 0) || [];
}

export const api = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  requestEmailOtp: (data) => request('/api/auth/request-email-otp', { method: 'POST', body: JSON.stringify(data) }),
  verifyEmailOtp: (data) => request('/api/auth/verify-email-otp', { method: 'POST', body: JSON.stringify(data) }),
<<<<<<< HEAD
  listStaff: () => request('/api/staff').then(unwrapList),
  createStaff: (data) => request('/api/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (membershipId, data) => request(`/api/staff/${membershipId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStaff: (membershipId) => request(`/api/staff/${membershipId}`, { method: 'DELETE' }),
  listProducts: () => request('/api/products').then(unwrapList),
  createProduct: (data) => request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  createPurchase: (data) => request('/api/purchases', { method: 'POST', body: JSON.stringify(data) }),
  listPurchases: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/purchases${suffix}`).then(unwrapList);
  },
  getPurchase: (id) => request(`/api/purchases/${id}`),
  updatePurchase: (id, data) => request(`/api/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createSale: (data) => request('/api/sales', { method: 'POST', body: JSON.stringify(data) }),
  listSales: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/sales${suffix}`).then(unwrapList);
  },
  getSale: (id) => request(`/api/sales/${id}`),
  updateSale: (id, data) => request(`/api/sales/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createService: (data) => request('/api/services', { method: 'POST', body: JSON.stringify(data) }),
  getService: (id) => request(`/api/services/${id}`),
  updateService: (id, data) => request(`/api/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  listServices: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/services${suffix}`).then(unwrapList);
  },
  lowStock: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/reports/low-stock${suffix}`).then(unwrapList);
  },
  inventorySummary: () => request('/api/reports/inventory-summary'),
  listParties: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/parties${suffix}`).then(unwrapList);
  },
  createParty: (data) => request('/api/parties', { method: 'POST', body: JSON.stringify(data) }),
  getParty: (id) => request(`/api/parties/${id}`),
  updateParty: (id, data) => request(`/api/parties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteParty: (id) => request(`/api/parties/${id}`, { method: 'DELETE' }),
  listPartyTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/party-transactions${suffix}`).then(unwrapList);
  },
  createPartyTransaction: (data) => request('/api/party-transactions', { method: 'POST', body: JSON.stringify(data) }),
  listOrderAttributes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/order-attributes${suffix}`).then(unwrapList);
  },
  createOrderAttribute: (data) => request('/api/order-attributes', { method: 'POST', body: JSON.stringify(data) }),
  getOrderAttribute: (id) => request(`/api/order-attributes/${id}`),
  updateOrderAttribute: (id, data) => request(`/api/order-attributes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrderAttribute: (id) => request(`/api/order-attributes/${id}`, { method: 'DELETE' }),
  getBusinessSettings: () => request('/api/business-settings'),
  updateBusinessSettings: (data) => request('/api/business-settings', { method: 'PUT', body: JSON.stringify(data) }),
=======

  listStaff: () => request('/api/staff', {}, listCache(['staff'], CACHE_TTL.short)),
  createStaff: (data) =>
    request('/api/staff', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['staff'])),
  updateStaff: (membershipId, data) =>
    request(`/api/staff/${membershipId}`, { method: 'PATCH', body: JSON.stringify(data) }, mutationConfig(['staff'])),
  deleteStaff: (membershipId) =>
    request(`/api/staff/${membershipId}`, { method: 'DELETE' }, mutationConfig(['staff'])),

  listProducts: (params = {}) =>
    collectionRequest('/api/products', { limit: 500, ...params }, listCache(['products', 'reports', 'dashboard'])),
  lookupProducts: (params = {}) =>
    collectionRequest('/api/products/lookup', params, listCache(['products'], CACHE_TTL.lookup)),
  createProduct: (data) =>
    request('/api/products', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['products', 'reports', 'dashboard'])),

  createPurchase: (data) =>
    request('/api/purchases', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['purchases', 'products', 'reports', 'dashboard', 'parties', 'party-statements', 'banks'])),
  listPurchases: (params = {}) => collectionRequest('/api/purchases', params, listCache(['purchases', 'reports', 'dashboard'])),
  getPurchase: (id) => request(`/api/purchases/${id}`, {}, listCache(detailTags('purchase', id), CACHE_TTL.detail)),
  updatePurchase: (id, data) =>
    request(`/api/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, mutationConfig([detailTags('purchase', id), 'purchases', 'products', 'reports', 'dashboard', 'parties', 'party-statements', 'banks'])),

  createSale: (data) =>
    request('/api/sales', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['sales', 'products', 'reports', 'dashboard', 'parties', 'party-statements', 'banks'])),
  listSales: (params = {}) => collectionRequest('/api/sales', params, listCache(['sales', 'reports', 'dashboard'])),
  getSale: (id) => request(`/api/sales/${id}`, {}, listCache(detailTags('sale', id), CACHE_TTL.detail)),
  updateSale: (id, data) =>
    request(`/api/sales/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, mutationConfig([detailTags('sale', id), 'sales', 'products', 'reports', 'dashboard', 'parties', 'party-statements', 'banks'])),

  createService: (data) =>
    request('/api/services', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['services', 'reports', 'dashboard', 'parties', 'party-statements', 'banks'])),
  getService: (id) => request(`/api/services/${id}`, {}, listCache(detailTags('service', id), CACHE_TTL.detail)),
  updateService: (id, data) =>
    request(`/api/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, mutationConfig([detailTags('service', id), 'services', 'reports', 'dashboard', 'parties', 'party-statements', 'banks'])),
  listServices: (params = {}) => collectionRequest('/api/services', params, listCache(['services', 'reports', 'dashboard'])),

  lowStock: (params = {}) => collectionRequest('/api/reports/low-stock', params, listCache(['reports', 'dashboard'], CACHE_TTL.report)),
  inventorySummary: (params = {}) => collectionRequest('/api/reports/inventory-summary', params, listCache(['reports', 'dashboard'], CACHE_TTL.report)),
  ledgerReport: (params = {}) => collectionRequest('/api/reports/ledger', params, listCache(['reports', 'party-statements'], CACHE_TTL.short)),
  partyReport: (params = {}) => collectionRequest('/api/reports/party-report', params, listCache(['reports', 'parties'], CACHE_TTL.report)),
  partyStatement: (params = {}) => collectionRequest('/api/reports/party-statement', params, listCache(['party-statements', 'parties'], CACHE_TTL.short)),
  partyDetailReport: (partyId, params = {}) => request(buildListPath(`/api/reports/party-detail/${partyId}`, params), {}, listCache(['party-statements', 'parties', 'reports'], CACHE_TTL.report)),
  salesReport: (params = {}) => collectionRequest('/api/reports/sales-report', params, listCache(['reports', 'sales'], CACHE_TTL.report)),
  serviceReport: (params = {}) => collectionRequest('/api/reports/service-report', params, listCache(['reports', 'services'], CACHE_TTL.report)),
  purchaseReport: (params = {}) => collectionRequest('/api/reports/purchase-report', params, listCache(['reports', 'purchases'], CACHE_TTL.report)),

  listParties: (params = {}) =>
    collectionRequest('/api/parties', { limit: 500, ...params }, listCache(['parties'], CACHE_TTL.lookup)),
  lookupParties: (params = {}) =>
    collectionRequest('/api/parties/lookup', params, listCache(['parties'], CACHE_TTL.lookup)),
  createParty: (data) =>
    request('/api/parties', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['parties', 'party-statements', 'reports'])),
  getParty: (id) => request(`/api/parties/${id}`, {}, listCache(detailTags('party', id), CACHE_TTL.detail)),
  updateParty: (id, data) =>
    request(`/api/parties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, mutationConfig([detailTags('party', id), 'parties', 'party-statements', 'reports'])),
  deleteParty: (id) =>
    request(`/api/parties/${id}`, { method: 'DELETE' }, mutationConfig([detailTags('party', id), 'parties', 'party-statements', 'reports'])),

  listPartyTransactions: (params = {}) => collectionRequest('/api/party-transactions', params, listCache(['party-transactions', 'party-statements'], CACHE_TTL.short)),
  createPartyTransaction: (data) =>
    request('/api/party-transactions', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['party-transactions', 'parties', 'party-statements', 'services', 'reports', 'banks'])),

  listBanks: (params = {}) => collectionRequest('/api/banks', params, listCache(['banks'], CACHE_TTL.short)),
  createBank: (data) =>
    request('/api/banks', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['banks'])),
  getBank: (id) => request(`/api/banks/${id}`, {}, listCache(detailTags('bank', id), CACHE_TTL.detail)),
  updateBank: (id, data) =>
    request(`/api/banks/${id}`, { method: 'PUT', body: JSON.stringify(data) }, mutationConfig([detailTags('bank', id), 'banks'])),
  patchBank: (id, data) =>
    request(`/api/banks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, mutationConfig([detailTags('bank', id), 'banks'])),
  deleteBank: (id) =>
    request(`/api/banks/${id}`, { method: 'DELETE' }, mutationConfig([detailTags('bank', id), 'banks'])),

  listOrderAttributes: (params = {}) => collectionRequest('/api/order-attributes', params, listCache(['order-attributes'], CACHE_TTL.settings)),
  createOrderAttribute: (data) =>
    request('/api/order-attributes', { method: 'POST', body: JSON.stringify(data) }, mutationConfig(['order-attributes'])),
  getOrderAttribute: (id) => request(`/api/order-attributes/${id}`, {}, listCache(detailTags('order-attribute', id), CACHE_TTL.settings)),
  updateOrderAttribute: (id, data) =>
    request(`/api/order-attributes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, mutationConfig([detailTags('order-attribute', id), 'order-attributes'])),
  deleteOrderAttribute: (id) =>
    request(`/api/order-attributes/${id}`, { method: 'DELETE' }, mutationConfig([detailTags('order-attribute', id), 'order-attributes'])),

  getBusinessSettings: () => request('/api/business-settings', {}, listCache(['business-settings'], CACHE_TTL.settings)),
  updateBusinessSettings: (data) =>
    request('/api/business-settings', { method: 'PUT', body: JSON.stringify(data) }, mutationConfig(['business-settings'])),

  getNextSequences: () => request('/api/meta/next-sequences', {}, listCache(['meta', 'sequences'], CACHE_TTL.short)),
  getDashboardSummary: (params = {}) => listRequest('/api/dashboard/summary', params, listCache(['dashboard'], CACHE_TTL.short)),
  getAnalyticsSummary: (params = {}) => listRequest('/api/analytics/summary', params, listCache(['analytics'], CACHE_TTL.short)),

>>>>>>> f55843f25a5884d9ce49cd3ca06047dbc9732af7
  uploadAttachment: (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return request('/api/uploads/attachment', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': '',
      },
    });
  },
};

export { toQueryKey };
