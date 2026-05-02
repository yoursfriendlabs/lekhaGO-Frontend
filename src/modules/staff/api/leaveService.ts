import dayjs from 'dayjs';
import type { LeaveRequest, LeaveRequestFormValues, ServiceResult } from '../types/staff';
import { staffFixtures } from '../data/fixtures';
import { requestJson, withMockFallback } from './client';

function normalizeLeaveRequest(entry: Record<string, unknown>): LeaveRequest {
  return {
    id: String(entry.id || ''),
    staffId: String(entry.staffId || ''),
    staffName: String(entry.staffName || ''),
    department: String(entry.department || ''),
    leaveType: (entry.leaveType || 'casual') as LeaveRequest['leaveType'],
    startDate: String(entry.startDate || ''),
    endDate: String(entry.endDate || ''),
    days: Number(entry.days || 0),
    reason: String(entry.reason || ''),
    status: (entry.status || 'pending') as LeaveRequest['status'],
    requestedAt: String(entry.requestedAt || ''),
    approverName: String(entry.approverName || ''),
    note: String(entry.note || ''),
  };
}

export const leaveService = {
  async listLeaveRequests(): Promise<ServiceResult<LeaveRequest[]>> {
    return withMockFallback(
      async () => {
        const response = await requestJson<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>('/api/staff/leave-requests');
        const items = Array.isArray(response) ? response : response.items || [];
        return items.map(normalizeLeaveRequest);
      },
      () => staffFixtures.listLeaveRequests(),
    );
  },

  async listLeaveBalances() {
    return withMockFallback(
      async () => requestJson('/api/staff/leave-requests/balances'),
      () => staffFixtures.listLeaveBalances(),
    );
  },

  async createLeaveRequest(values: LeaveRequestFormValues) {
    return withMockFallback(
      async () => normalizeLeaveRequest(await requestJson('/api/staff/leave-requests', {
        method: 'POST',
        body: JSON.stringify(values),
      })),
      () => {
        const staff = staffFixtures.listStaffRecords().find((item) => item.id === values.staffId);
        const days = Math.max(dayjs(values.endDate).diff(dayjs(values.startDate), 'day') + 1, 1);

        return staffFixtures.createLeaveRequest({
          id: '',
          staffId: values.staffId,
          staffName: staff?.fullName || 'Unknown staff',
          department: staff?.department || 'General',
          leaveType: values.leaveType,
          startDate: values.startDate,
          endDate: values.endDate,
          days,
          reason: values.reason,
          status: 'pending',
          requestedAt: dayjs().toISOString(),
          note: values.note,
        });
      },
    );
  },

  async updateLeaveRequestStatus(requestId: string, status: LeaveRequest['status']) {
    return withMockFallback(
      async () => normalizeLeaveRequest(await requestJson(`/api/staff/leave-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })),
      () => staffFixtures.updateLeaveRequest(requestId, {
        status,
        approverName: status === 'approved' ? 'Current Manager' : '',
      })!,
    );
  },
};
