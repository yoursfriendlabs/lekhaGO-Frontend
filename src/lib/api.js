import { getBusinessId, getToken } from './storage';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.yoursfriend.com';

async function request(path, options = {}) {
  const token = getToken();
  const businessId = getBusinessId();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (businessId) headers['x-business-id'] = businessId;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const message = payload?.message || 'Request failed';
    throw new Error(message);
  }

  return payload;
}

export const api = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  listProducts: () => request('/api/products'),
  createProduct: (data) => request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  listLocations: () => request('/api/inventory/locations'),
  createLocation: (data) => request('/api/inventory/locations', { method: 'POST', body: JSON.stringify(data) }),
  listBatches: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return request(`/api/inventory/batches${suffix}`);
  },
  createBatch: (data) => request('/api/inventory/batches', { method: 'POST', body: JSON.stringify(data) }),
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
  listCustomers: () => request('/api/customers'),
  createCustomer: (data) => request('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
  listSuppliers: () => request('/api/suppliers'),
  createSupplier: (data) => request('/api/suppliers', { method: 'POST', body: JSON.stringify(data) }),
};
