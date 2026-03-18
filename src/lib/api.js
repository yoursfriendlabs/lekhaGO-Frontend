import { getBusinessId, getToken } from './storage';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.yoursfriend.com';

async function request(path, options = {}) {
  const token = getToken();
  const businessId = getBusinessId();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (businessId) headers['x-business-id'] = businessId;

  if (headers['Content-Type'] === '') {
    delete headers['Content-Type'];
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const message = payload?.message || 'Request failed';
    const error = new Error(message);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  requestEmailOtp: (data) => request('/api/auth/request-email-otp', { method: 'POST', body: JSON.stringify(data) }),
  verifyEmailOtp: (data) => request('/api/auth/verify-email-otp', { method: 'POST', body: JSON.stringify(data) }),
  listProducts: () => request('/api/products'),
  createProduct: (data) => request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  createPurchase: (data) => request('/api/purchases', { method: 'POST', body: JSON.stringify(data) }),
  listPurchases: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/purchases${suffix}`);
  },
  getPurchase: (id) => request(`/api/purchases/${id}`),
  updatePurchase: (id, data) => request(`/api/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createSale: (data) => request('/api/sales', { method: 'POST', body: JSON.stringify(data) }),
  listSales: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/sales${suffix}`);
  },
  getSale: (id) => request(`/api/sales/${id}`),
  updateSale: (id, data) => request(`/api/sales/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createService: (data) => request('/api/services', { method: 'POST', body: JSON.stringify(data) }),
  getService: (id) => request(`/api/services/${id}`),
  updateService: (id, data) => request(`/api/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  listServices: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/services${suffix}`);
  },
  lowStock: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/reports/low-stock${suffix}`);
  },
  inventorySummary: () => request('/api/reports/inventory-summary'),
  listParties: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/parties${suffix}`);
  },
  createParty: (data) => request('/api/parties', { method: 'POST', body: JSON.stringify(data) }),
  getParty: (id) => request(`/api/parties/${id}`),
  updateParty: (id, data) => request(`/api/parties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteParty: (id) => request(`/api/parties/${id}`, { method: 'DELETE' }),
  listPartyTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/party-transactions${suffix}`);
  },
  createPartyTransaction: (data) => request('/api/party-transactions', { method: 'POST', body: JSON.stringify(data) }),
  listOrderAttributes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/order-attributes${suffix}`);
  },
  createOrderAttribute: (data) => request('/api/order-attributes', { method: 'POST', body: JSON.stringify(data) }),
  getOrderAttribute: (id) => request(`/api/order-attributes/${id}`),
  updateOrderAttribute: (id, data) => request(`/api/order-attributes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrderAttribute: (id) => request(`/api/order-attributes/${id}`, { method: 'DELETE' }),
  getBusinessSettings: () => request('/api/business-settings'),
  updateBusinessSettings: (data) => request('/api/business-settings', { method: 'PUT', body: JSON.stringify(data) }),
  uploadAttachment: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/uploads/attachment', {
      method: 'POST',
      body: formData,
      headers: {
        // Let the browser set the boundary for multipart/form-data
        'Content-Type': '',
      },
    });
  },
};
