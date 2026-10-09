import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { api, clearApiCache } from './api';

const response = (body) => ({
  ok: true, status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body,
});
let fetchMock;
beforeEach(() => {
  clearApiCache();
  localStorage.setItem('mms_token', 'student-test-token');
  localStorage.setItem('mms_business_id', 'cafe-1');
  fetchMock = vi.fn().mockResolvedValue(response({ items: [], total: 0 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); clearApiCache(); });

describe('Students API integration', () => {
  it('sends atomic registration with the business and authorization headers', async () => {
    const body = { name: 'Anita', enrollment: { courseId: 'c1', shiftIds: ['morning', 'evening'], amountPaid: 5000 } };
    await api.createStudent(body);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/students$/);
    expect(request).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer student-test-token', 'x-business-id': 'cafe-1' } });
    expect(JSON.parse(request.body)).toEqual(body);
  });
  it('invalidates balances, transactions, sales, banks and dues after an installment', async () => {
    const readers = [
      () => api.partyStatement({ partyId: 'p1' }),
      () => api.listPartyTransactions({ partyId: 'p1' }),
      () => api.getSaleStats(),
      () => api.listBanks(),
      () => api.listStudentDues(),
    ];
    for (const read of readers) await read();
    const initialCalls = fetchMock.mock.calls.length;
    for (const read of readers) await read();
    expect(fetchMock).toHaveBeenCalledTimes(initialCalls);
    await api.collectEnrollmentFee('e1', { amount: 4000, txDate: '2026-10-09', paymentMethod: 'cash' });
    const [url, request] = fetchMock.mock.calls[initialCalls];
    expect(url).toMatch(/\/api\/students\/enrollments\/e1\/payments$/);
    expect(JSON.parse(request.body)).toMatchObject({ amount: 4000, txDate: '2026-10-09' });
    for (const read of readers) await read();
    expect(fetchMock).toHaveBeenCalledTimes(initialCalls * 2 + 1);
  });
  it('refreshes bank balances after a paid enrollment', async () => {
    await api.listBanks();
    await api.createEnrollment({ studentId: 's1', courseId: 'c1', amountPaid: 5000, shiftIds: ['morning'] });
    await api.listBanks();
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/api/banks'))).toHaveLength(2);
  });
  it('isolates collection caches by business', async () => {
    await api.listStudents();
    await api.listStudents();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    localStorage.setItem('mms_business_id', 'cafe-2');
    await api.listStudents();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers['x-business-id']).toBe('cafe-2');
  });
});
