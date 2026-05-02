import type { AttendanceCorrectionValues, AttendanceFilters, AttendanceRecord, ServiceResult } from '../types/staff';
import { staffFixtures } from '../data/fixtures';
import { buildStaffPath, requestJson, withMockFallback } from './client';

function normalizeAttendance(entry: Record<string, unknown>): AttendanceRecord {
  return {
    id: String(entry.id || ''),
    staffId: String(entry.staffId || ''),
    staffName: String(entry.staffName || ''),
    department: String(entry.department || ''),
    designation: String(entry.designation || ''),
    attendanceDate: String(entry.attendanceDate || entry.date || ''),
    shiftName: String(entry.shiftName || ''),
    clockIn: String(entry.clockIn || ''),
    clockOut: String(entry.clockOut || ''),
    workedHours: Number(entry.workedHours || 0),
    lateMinutes: Number(entry.lateMinutes || 0),
    overtimeMinutes: Number(entry.overtimeMinutes || 0),
    status: (entry.status || 'present') as AttendanceRecord['status'],
    approvalStatus: (entry.approvalStatus || 'pending') as AttendanceRecord['approvalStatus'],
    correctionReason: String(entry.correctionReason || ''),
    notes: String(entry.notes || ''),
  };
}

function filterAttendance(items: AttendanceRecord[], filters: AttendanceFilters) {
  const query = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.staffId && item.staffId !== filters.staffId) return false;
    if (filters.department && item.department !== filters.department) return false;
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.startDate && item.attendanceDate < filters.startDate) return false;
    if (filters.endDate && item.attendanceDate > filters.endDate) return false;
    if (!query) return true;

    return [item.staffName, item.department, item.shiftName].some((value) =>
      value.toLowerCase().includes(query),
    );
  });
}

export const attendanceService = {
  async listAttendance(filters: AttendanceFilters): Promise<ServiceResult<AttendanceRecord[]>> {
    return withMockFallback(
      async () => {
        const response = await requestJson<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>(
          buildStaffPath('/api/staff/attendance', {
            search: filters.search || undefined,
            staffId: filters.staffId || undefined,
            department: filters.department || undefined,
            status: filters.status === 'all' ? undefined : filters.status,
            from: filters.startDate || undefined,
            to: filters.endDate || undefined,
          }),
        );
        const items = Array.isArray(response) ? response : response.items || [];
        return items.map(normalizeAttendance);
      },
      () => filterAttendance(staffFixtures.listAttendance(), filters),
    );
  },

  async correctAttendance(recordId: string, values: AttendanceCorrectionValues) {
    return withMockFallback(
      async () => normalizeAttendance(await requestJson(`/api/staff/attendance/${recordId}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      })),
      () => staffFixtures.updateAttendance(recordId, values)!,
    );
  },

  async setAttendanceApproval(recordId: string, approvalStatus: AttendanceRecord['approvalStatus']) {
    return this.correctAttendance(recordId, {
      status: 'present',
      approvalStatus,
      correctionReason: approvalStatus === 'rejected' ? 'Rejected by approver.' : 'Approved by approver.',
      clockIn: '',
      clockOut: '',
    });
  },
};
