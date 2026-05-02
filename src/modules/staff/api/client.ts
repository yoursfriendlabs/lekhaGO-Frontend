import { API_BASE } from '../../../lib/api';
import { getBusinessId, getToken } from '../../../lib/storage';
import type { ApiDataSource, ServiceResult } from '../types/staff';

export class StaffApiError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = 'StaffApiError';
    this.status = status;
    this.payload = payload;
  }
}

const STAFF_MOCK_FLAG = import.meta.env.VITE_STAFF_MODULE_MOCK === '1';

function buildHeaders(contentType = 'application/json') {
  const headers: Record<string, string> = {};
  const token = getToken();
  const businessId = getBusinessId();

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (businessId) {
    headers['x-business-id'] = businessId;
  }

  return headers;
}

function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === null) {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

export function buildStaffPath(path: string, params: Record<string, string | number | boolean | undefined> = {}) {
  const query = toQueryString(params);
  return query ? `${path}?${query}` : path;
}

export async function requestJson<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(init.body instanceof FormData ? '' : 'application/json'),
      ...(init.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new StaffApiError((payload as { message?: string } | null)?.message || 'Request failed', response.status, payload);
  }

  return payload as T;
}

export async function withMockFallback<T>(
  requestFactory: () => Promise<T>,
  mockFactory: () => T | Promise<T>,
) {
  if (STAFF_MOCK_FLAG) {
    return {
      data: await mockFactory(),
      source: 'mock' as ApiDataSource,
    } satisfies ServiceResult<T>;
  }

  try {
    const data = await requestFactory();
    return {
      data,
      source: 'live' as ApiDataSource,
    } satisfies ServiceResult<T>;
  } catch (error) {
    if (error instanceof StaffApiError && ![404, 405, 500, 501, 503].includes(error.status || 0)) {
      throw error;
    }

    return {
      data: await mockFactory(),
      source: 'mock' as ApiDataSource,
    } satisfies ServiceResult<T>;
  }
}
