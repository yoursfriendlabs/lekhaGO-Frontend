import type { OvertimePolicy, OvertimeSummaryItem, ServiceResult } from '../types/staff';
import { staffFixtures } from '../data/fixtures';
import { buildStaffPath, requestJson, withMockFallback } from './client';

function normalizePolicy(entry: Record<string, unknown>): OvertimePolicy {
  return {
    id: String(entry.id || ''),
    name: String(entry.name || ''),
    effectiveFrom: String(entry.effectiveFrom || ''),
    thresholdMinutes: Number(entry.thresholdMinutes || 0),
    rounding: (entry.rounding || 'none') as OvertimePolicy['rounding'],
    multiplier: Number(entry.multiplier || 1),
    isActive: Boolean(entry.isActive ?? true),
  };
}

function normalizeSummary(entry: Record<string, unknown>): OvertimeSummaryItem {
  return {
    staffId: String(entry.staffId || ''),
    staffName: String(entry.staffName || ''),
    department: String(entry.department || ''),
    scheduledHours: Number(entry.scheduledHours || 0),
    workedHours: Number(entry.workedHours || 0),
    overtimeHours: Number(entry.overtimeHours || 0),
    approvedOvertimeHours: Number(entry.approvedOvertimeHours || 0),
    overtimeAmount: Number(entry.overtimeAmount || 0),
    approvalStatus: (entry.approvalStatus || 'pending') as OvertimeSummaryItem['approvalStatus'],
  };
}

export const overtimeService = {
  async listPolicies(): Promise<ServiceResult<OvertimePolicy[]>> {
    return withMockFallback(
      async () => {
        const response = await requestJson<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>('/api/staff/overtime-policies');
        const items = Array.isArray(response) ? response : response.items || [];
        return items.map(normalizePolicy);
      },
      () => staffFixtures.listOvertimePolicies(),
    );
  },

  async listSummary(filters: { staffId: string; department: string; startDate: string; endDate: string; approvalStatus: string }): Promise<ServiceResult<OvertimeSummaryItem[]>> {
    return withMockFallback(
      async () => {
        const response = await requestJson<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>(
          buildStaffPath('/api/staff/overtime', {
            staffId: filters.staffId || undefined,
            department: filters.department || undefined,
            from: filters.startDate || undefined,
            to: filters.endDate || undefined,
            approvalStatus: filters.approvalStatus === 'all' ? undefined : filters.approvalStatus,
          }),
        );
        const items = Array.isArray(response) ? response : response.items || [];
        return items.map(normalizeSummary);
      },
      () =>
        staffFixtures
          .listOvertimeSummary()
          .filter((item) => (filters.staffId ? item.staffId === filters.staffId : true))
          .filter((item) => (filters.department ? item.department === filters.department : true))
          .filter((item) => (filters.approvalStatus !== 'all' ? item.approvalStatus === filters.approvalStatus : true)),
    );
  },
};
