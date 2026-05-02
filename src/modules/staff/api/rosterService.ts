import dayjs from 'dayjs';
import type { RosterCell, RosterSnapshot, ServiceResult, ShiftAssignment, ShiftAssignmentFormValues } from '../types/staff';
import { staffFixtures } from '../data/fixtures';
import { buildStaffPath, requestJson, withMockFallback } from './client';

function normalizeAssignment(entry: Record<string, unknown>): ShiftAssignment {
  return {
    id: String(entry.id || ''),
    staffId: String(entry.staffId || ''),
    staffName: String(entry.staffName || ''),
    shiftTemplateId: String(entry.shiftTemplateId || ''),
    shiftName: String(entry.shiftName || ''),
    dateFrom: String(entry.dateFrom || ''),
    dateTo: String(entry.dateTo || ''),
    weeklyOffDays: Array.isArray(entry.weeklyOffDays) ? entry.weeklyOffDays.map(Number) : [],
    note: String(entry.note || ''),
  };
}

function buildRosterSnapshot(
  assignments: ShiftAssignment[],
  staffRecords: ReturnType<typeof staffFixtures.listStaffRecords>,
  shiftTemplates: ReturnType<typeof staffFixtures.listShiftTemplates>,
  focusDate: string,
  viewMode: 'week' | 'month',
): RosterSnapshot {
  const focus = dayjs(focusDate);
  const start = viewMode === 'week' ? focus.startOf('week') : focus.startOf('month').startOf('week');
  const end = viewMode === 'week' ? focus.endOf('week') : focus.endOf('month').endOf('week');
  const days = Array.from({ length: end.diff(start, 'day') + 1 }).map((_, index) => {
    const date = start.add(index, 'day');
    return {
      date: date.format('YYYY-MM-DD'),
      label: viewMode === 'week' ? date.format('ddd D') : date.format('D'),
      weekend: [0, 6].includes(date.day()),
    };
  });

  const conflicts: string[] = [];

  const rows = staffRecords
    .filter((record) => record.isActive)
    .map((record) => {
      const recordAssignments = assignments.filter((assignment) => assignment.staffId === record.id);

      const cells: RosterCell[] = days.map((day) => {
        const matchingAssignments = recordAssignments.filter((assignment) => {
          const current = dayjs(day.date);
          return (
            current.isSameOrAfter(dayjs(assignment.dateFrom), 'day') &&
            current.isSameOrBefore(dayjs(assignment.dateTo), 'day')
          );
        });

        if (matchingAssignments.length > 1) {
          conflicts.push(`${record.fullName} has overlapping shift assignments on ${dayjs(day.date).format('MMM D')}.`);
        }

        const assignment = matchingAssignments[0];
        const template = shiftTemplates.find((shift) => shift.id === assignment?.shiftTemplateId);
        const isWeekOff = assignment?.weeklyOffDays.includes(dayjs(day.date).day()) || false;

        return {
          date: day.date,
          dayLabel: day.label,
          shiftName: isWeekOff ? 'Week off' : assignment?.shiftName,
          shiftTime: isWeekOff || !template ? '' : `${template.startTime} - ${template.endTime}`,
          color: template?.color,
          isWeekOff,
          hasConflict: matchingAssignments.length > 1,
          notes: assignment?.note,
        };
      });

      return {
        staffId: record.id,
        staffName: record.fullName,
        department: record.department,
        designation: record.designation,
        cells,
      };
    });

  return {
    viewMode,
    focusDate,
    days,
    rows,
    conflicts,
  };
}

export const rosterService = {
  async listShiftAssignments(): Promise<ServiceResult<ShiftAssignment[]>> {
    return withMockFallback(
      async () => {
        const response = await requestJson<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>('/api/staff/assignments');
        const items = Array.isArray(response) ? response : response.items || [];
        return items.map(normalizeAssignment);
      },
      () => staffFixtures.listShiftAssignments(),
    );
  },

  async createShiftAssignments(values: ShiftAssignmentFormValues) {
    return withMockFallback(
      async () => {
        const response = await requestJson<Record<string, unknown>[] | Record<string, unknown>>('/api/staff/assignments', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        const items = Array.isArray(response) ? response : [response];
        return items.map(normalizeAssignment);
      },
      () => {
        const staffRecords = staffFixtures.listStaffRecords();
        const shiftTemplates = staffFixtures.listShiftTemplates();
        const template = shiftTemplates.find((item) => item.id === values.shiftTemplateId);

        return staffFixtures.createShiftAssignments(values.staffIds.map((staffId) => {
          const staff = staffRecords.find((item) => item.id === staffId);

          return {
            id: '',
            staffId,
            staffName: staff?.fullName || 'Unknown staff',
            shiftTemplateId: values.shiftTemplateId,
            shiftName: template?.name || 'Shift',
            dateFrom: values.dateFrom,
            dateTo: values.dateTo,
            weeklyOffDays: values.weeklyOffDays,
            note: values.note,
          };
        }));
      },
    );
  },

  async getRosterSnapshot(focusDate: string, viewMode: 'week' | 'month'): Promise<ServiceResult<RosterSnapshot>> {
    return withMockFallback(
      async () => {
        const response = await requestJson<RosterSnapshot>(
          buildStaffPath('/api/staff/roster', { focusDate, viewMode }),
        );
        return response;
      },
      () =>
        buildRosterSnapshot(
          staffFixtures.listShiftAssignments(),
          staffFixtures.listStaffRecords(),
          staffFixtures.listShiftTemplates(),
          focusDate,
          viewMode,
        ),
    );
  },
};
