import dayjs from 'dayjs';
import type {
  AttendanceRecord,
  LeaveBalance,
  LeaveRequest,
  LinkedAccount,
  OvertimePolicy,
  OvertimeSummaryItem,
  PayrollRun,
  ShiftAssignment,
  ShiftTemplate,
  StaffRecord,
} from '../types/staff';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const linkedAccounts: LinkedAccount[] = [
  {
    membershipId: 'mem-1',
    name: 'Aarav Gautam',
    email: 'aarav@managemyshop.local',
    phone: '9801000001',
    role: 'staff',
    isActive: true,
    emailVerified: true,
  },
  {
    membershipId: 'mem-2',
    name: 'Sita Karki',
    email: 'sita@managemyshop.local',
    phone: '9801000002',
    role: 'staff',
    isActive: true,
    emailVerified: true,
  },
  {
    membershipId: 'mem-3',
    name: 'Rohan Bista',
    email: 'rohan@managemyshop.local',
    phone: '9801000003',
    role: 'staff',
    isActive: false,
    emailVerified: false,
  },
];

const staffRecords: StaffRecord[] = [
  {
    id: 'staff-1',
    staffCode: 'ST-001',
    fullName: 'Aarav Gautam',
    email: 'aarav@managemyshop.local',
    phone: '9801000001',
    designation: 'Floor Manager',
    department: 'Operations',
    joinedOn: '2024-07-08',
    salaryType: 'monthly',
    salaryAmount: 42000,
    isActive: true,
    notes: 'Primary opener for weekday operations.',
    linkedMembershipId: 'mem-1',
    linkedAccount: linkedAccounts[0],
    financeSummary: {
      openingAdvanceBalance: 0,
      totalSalaryPaid: 378000,
      totalAdvanceGiven: 12000,
      totalAdvanceRepaid: 8000,
      outstandingAdvanceBalance: 4000,
    },
    recentTransactions: [
      {
        id: 'led-101',
        staffId: 'staff-1',
        entryType: 'salary_payment',
        amount: 42000,
        entryDate: '2026-04-30',
        referenceMonth: '2026-04',
        paymentMethod: 'bank',
        bankName: 'Nabil Bank',
        note: 'April payroll settled',
      },
      {
        id: 'led-102',
        staffId: 'staff-1',
        entryType: 'advance',
        amount: 5000,
        entryDate: '2026-04-11',
        paymentMethod: 'cash',
        note: 'Travel advance',
      },
      {
        id: 'led-103',
        staffId: 'staff-1',
        entryType: 'advance_repayment',
        amount: 3000,
        entryDate: '2026-04-30',
        paymentMethod: 'payroll',
        note: 'Recovered with April payroll',
      },
    ],
  },
  {
    id: 'staff-2',
    staffCode: 'ST-002',
    fullName: 'Sita Karki',
    email: 'sita@managemyshop.local',
    phone: '9801000002',
    designation: 'Senior Cashier',
    department: 'Sales',
    joinedOn: '2025-01-15',
    salaryType: 'monthly',
    salaryAmount: 32000,
    isActive: true,
    notes: 'Handles cash close and shift handover.',
    linkedMembershipId: 'mem-2',
    linkedAccount: linkedAccounts[1],
    financeSummary: {
      openingAdvanceBalance: 1000,
      totalSalaryPaid: 128000,
      totalAdvanceGiven: 8000,
      totalAdvanceRepaid: 6000,
      outstandingAdvanceBalance: 3000,
    },
    recentTransactions: [
      {
        id: 'led-201',
        staffId: 'staff-2',
        entryType: 'salary_payment',
        amount: 32000,
        entryDate: '2026-04-30',
        referenceMonth: '2026-04',
        paymentMethod: 'bank',
        bankName: 'Global IME',
        note: 'April payroll settled',
      },
      {
        id: 'led-202',
        staffId: 'staff-2',
        entryType: 'advance',
        amount: 3000,
        entryDate: '2026-04-18',
        paymentMethod: 'cash',
        note: 'Festival advance',
      },
    ],
  },
  {
    id: 'staff-3',
    staffCode: 'ST-003',
    fullName: 'Rohan Bista',
    email: 'rohan@managemyshop.local',
    phone: '9801000003',
    designation: 'Service Technician',
    department: 'Service',
    joinedOn: '2024-11-20',
    salaryType: 'daily',
    salaryAmount: 1800,
    isActive: false,
    notes: 'Currently inactive after contract pause.',
    linkedMembershipId: 'mem-3',
    linkedAccount: linkedAccounts[2],
    financeSummary: {
      openingAdvanceBalance: 0,
      totalSalaryPaid: 72000,
      totalAdvanceGiven: 0,
      totalAdvanceRepaid: 0,
      outstandingAdvanceBalance: 0,
    },
    recentTransactions: [
      {
        id: 'led-301',
        staffId: 'staff-3',
        entryType: 'salary_payment',
        amount: 19800,
        entryDate: '2026-03-30',
        referenceMonth: '2026-03',
        paymentMethod: 'cash',
        note: 'March attendance payout',
      },
    ],
  },
  {
    id: 'staff-4',
    staffCode: 'ST-004',
    fullName: 'Mina Shrestha',
    email: 'mina@managemyshop.local',
    phone: '9801000004',
    designation: 'Inventory Associate',
    department: 'Warehouse',
    joinedOn: '2025-08-01',
    salaryType: 'monthly',
    salaryAmount: 28000,
    isActive: true,
    notes: 'Supports morning receiving and stock audits.',
    linkedAccount: null,
    financeSummary: {
      openingAdvanceBalance: 2000,
      totalSalaryPaid: 196000,
      totalAdvanceGiven: 12000,
      totalAdvanceRepaid: 5000,
      outstandingAdvanceBalance: 9000,
    },
    recentTransactions: [
      {
        id: 'led-401',
        staffId: 'staff-4',
        entryType: 'salary_payment',
        amount: 28000,
        entryDate: '2026-04-30',
        referenceMonth: '2026-04',
        paymentMethod: 'cash',
        note: 'April payroll settled',
      },
    ],
  },
];

const shiftTemplates: ShiftTemplate[] = [
  {
    id: 'shift-1',
    shiftCode: 'MORN',
    name: 'Morning Shift',
    startTime: '08:00',
    endTime: '16:00',
    crossMidnight: false,
    breakMinutes: 45,
    graceMinutes: 10,
    overtimeThresholdMinutes: 30,
    overtimeRounding: 'nearest_30',
    overtimeMultiplier: 1.25,
    isActive: true,
    workingDays: [0, 1, 2, 3, 4, 5],
    color: '#D97706',
  },
  {
    id: 'shift-2',
    shiftCode: 'EVE',
    name: 'Evening Shift',
    startTime: '13:00',
    endTime: '21:00',
    crossMidnight: false,
    breakMinutes: 30,
    graceMinutes: 5,
    overtimeThresholdMinutes: 15,
    overtimeRounding: 'nearest_15',
    overtimeMultiplier: 1.5,
    isActive: true,
    workingDays: [0, 1, 2, 3, 4, 5],
    color: '#2563EB',
  },
  {
    id: 'shift-3',
    shiftCode: 'NITE',
    name: 'Night Audit',
    startTime: '21:30',
    endTime: '05:30',
    crossMidnight: true,
    breakMinutes: 30,
    graceMinutes: 5,
    overtimeThresholdMinutes: 15,
    overtimeRounding: 'nearest_15',
    overtimeMultiplier: 1.75,
    isActive: true,
    workingDays: [1, 2, 3, 4, 5],
    color: '#7C3AED',
  },
];

const shiftAssignments: ShiftAssignment[] = [
  {
    id: 'assign-1',
    staffId: 'staff-1',
    staffName: 'Aarav Gautam',
    shiftTemplateId: 'shift-1',
    shiftName: 'Morning Shift',
    dateFrom: '2026-04-28',
    dateTo: '2026-05-31',
    weeklyOffDays: [6],
    note: 'Regular operations roster',
  },
  {
    id: 'assign-2',
    staffId: 'staff-2',
    staffName: 'Sita Karki',
    shiftTemplateId: 'shift-2',
    shiftName: 'Evening Shift',
    dateFrom: '2026-04-28',
    dateTo: '2026-05-31',
    weeklyOffDays: [5],
    note: 'Counter close coverage',
  },
  {
    id: 'assign-3',
    staffId: 'staff-4',
    staffName: 'Mina Shrestha',
    shiftTemplateId: 'shift-1',
    shiftName: 'Morning Shift',
    dateFrom: '2026-05-01',
    dateTo: '2026-05-15',
    weeklyOffDays: [0],
    note: 'Receiving slot',
  },
  {
    id: 'assign-4',
    staffId: 'staff-4',
    staffName: 'Mina Shrestha',
    shiftTemplateId: 'shift-2',
    shiftName: 'Evening Shift',
    dateFrom: '2026-05-10',
    dateTo: '2026-05-18',
    weeklyOffDays: [0],
    note: 'Temporary overlap to show conflict resolution',
  },
];

const attendanceRecords: AttendanceRecord[] = Array.from({ length: 14 }).flatMap((_, index) => {
  const date = dayjs('2026-04-20').add(index, 'day').format('YYYY-MM-DD');

  return [
    {
      id: `att-a-${date}`,
      staffId: 'staff-1',
      staffName: 'Aarav Gautam',
      department: 'Operations',
      designation: 'Floor Manager',
      attendanceDate: date,
      shiftName: 'Morning Shift',
      clockIn: `${date}T08:05:00`,
      clockOut: `${date}T16:18:00`,
      workedHours: 7.5,
      lateMinutes: 5,
      overtimeMinutes: 18,
      status: index % 5 === 0 ? 'late' : 'present',
      approvalStatus: index % 6 === 0 ? 'pending' : 'approved',
      correctionReason: index % 6 === 0 ? 'Pending manager review for manual check-in.' : '',
      notes: 'Synced from biometric import.',
    },
    {
      id: `att-s-${date}`,
      staffId: 'staff-2',
      staffName: 'Sita Karki',
      department: 'Sales',
      designation: 'Senior Cashier',
      attendanceDate: date,
      shiftName: 'Evening Shift',
      clockIn: `${date}T13:01:00`,
      clockOut: `${date}T21:34:00`,
      workedHours: 7.8,
      lateMinutes: 1,
      overtimeMinutes: 34,
      status: index === 3 ? 'half_day' : 'present',
      approvalStatus: index === 3 ? 'rejected' : 'approved',
      correctionReason: index === 3 ? 'Correction rejected after audit mismatch.' : '',
      notes: 'Counter close verified.',
    },
  ];
});

const overtimePolicies: OvertimePolicy[] = [
  {
    id: 'otp-1',
    name: 'Standard Retail OT',
    effectiveFrom: '2026-01-01',
    thresholdMinutes: 30,
    rounding: 'nearest_30',
    multiplier: 1.5,
    isActive: true,
  },
];

const overtimeSummary: OvertimeSummaryItem[] = [
  {
    staffId: 'staff-1',
    staffName: 'Aarav Gautam',
    department: 'Operations',
    scheduledHours: 208,
    workedHours: 214.5,
    overtimeHours: 6.5,
    approvedOvertimeHours: 5.5,
    overtimeAmount: 5192,
    approvalStatus: 'approved',
  },
  {
    staffId: 'staff-2',
    staffName: 'Sita Karki',
    department: 'Sales',
    scheduledHours: 208,
    workedHours: 216,
    overtimeHours: 8,
    approvedOvertimeHours: 7,
    overtimeAmount: 4038,
    approvalStatus: 'approved',
  },
  {
    staffId: 'staff-4',
    staffName: 'Mina Shrestha',
    department: 'Warehouse',
    scheduledHours: 208,
    workedHours: 210.25,
    overtimeHours: 2.25,
    approvedOvertimeHours: 1.75,
    overtimeAmount: 963,
    approvalStatus: 'pending',
  },
];

const leaveRequests: LeaveRequest[] = [
  {
    id: 'leave-1',
    staffId: 'staff-2',
    staffName: 'Sita Karki',
    department: 'Sales',
    leaveType: 'casual',
    startDate: '2026-05-06',
    endDate: '2026-05-07',
    days: 2,
    reason: 'Family event out of town.',
    status: 'pending',
    requestedAt: '2026-05-01T09:30:00',
  },
  {
    id: 'leave-2',
    staffId: 'staff-1',
    staffName: 'Aarav Gautam',
    department: 'Operations',
    leaveType: 'annual',
    startDate: '2026-05-20',
    endDate: '2026-05-22',
    days: 3,
    reason: 'Pre-approved annual leave.',
    status: 'approved',
    requestedAt: '2026-04-10T13:15:00',
    approverName: 'Dipesh Basnet',
  },
];

const leaveBalances: LeaveBalance[] = [
  { leaveType: 'annual', total: 18, used: 7, remaining: 11 },
  { leaveType: 'casual', total: 12, used: 3, remaining: 9 },
  { leaveType: 'sick', total: 10, used: 2, remaining: 8 },
  { leaveType: 'unpaid', total: 99, used: 1, remaining: 98 },
];

const payrollRuns: PayrollRun[] = [
  {
    id: 'pay-2026-04',
    runCode: 'PAY-2026-04',
    title: 'April 2026 Payroll',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    payoutDate: '2026-04-30',
    status: 'approved',
    totals: {
      staffCount: 4,
      grossAmount: 123600,
      totalOvertime: 10193,
      totalDeductions: 9100,
      netPayable: 124693,
    },
    items: [
      {
        id: 'pay-item-1',
        staffId: 'staff-1',
        staffName: 'Aarav Gautam',
        designation: 'Floor Manager',
        baseSalary: 42000,
        overtime: 5192,
        bonus: 0,
        deductions: 1400,
        advanceRecovery: 3000,
        netPayable: 42792,
        paymentStatus: 'paid',
      },
      {
        id: 'pay-item-2',
        staffId: 'staff-2',
        staffName: 'Sita Karki',
        designation: 'Senior Cashier',
        baseSalary: 32000,
        overtime: 4038,
        bonus: 1000,
        deductions: 1200,
        advanceRecovery: 2000,
        netPayable: 33838,
        paymentStatus: 'processing',
      },
      {
        id: 'pay-item-3',
        staffId: 'staff-3',
        staffName: 'Rohan Bista',
        designation: 'Service Technician',
        baseSalary: 19800,
        overtime: 0,
        bonus: 0,
        deductions: 0,
        advanceRecovery: 0,
        netPayable: 19800,
        paymentStatus: 'pending',
      },
      {
        id: 'pay-item-4',
        staffId: 'staff-4',
        staffName: 'Mina Shrestha',
        designation: 'Inventory Associate',
        baseSalary: 28000,
        overtime: 963,
        bonus: 0,
        deductions: 6500,
        advanceRecovery: 2100,
        netPayable: 20363,
        paymentStatus: 'pending',
      },
    ],
  },
  {
    id: 'pay-2026-05',
    runCode: 'PAY-2026-05',
    title: 'May 2026 Payroll',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    payoutDate: '2026-05-31',
    status: 'draft',
    totals: {
      staffCount: 4,
      grossAmount: 126000,
      totalOvertime: 0,
      totalDeductions: 0,
      netPayable: 126000,
    },
    items: [],
  },
];

type MockDb = {
  linkedAccounts: LinkedAccount[];
  staffRecords: StaffRecord[];
  shiftTemplates: ShiftTemplate[];
  shiftAssignments: ShiftAssignment[];
  attendanceRecords: AttendanceRecord[];
  overtimePolicies: OvertimePolicy[];
  overtimeSummary: OvertimeSummaryItem[];
  leaveRequests: LeaveRequest[];
  leaveBalances: LeaveBalance[];
  payrollRuns: PayrollRun[];
};

const mockDb: MockDb = {
  linkedAccounts,
  staffRecords,
  shiftTemplates,
  shiftAssignments,
  attendanceRecords,
  overtimePolicies,
  overtimeSummary,
  leaveRequests,
  leaveBalances,
  payrollRuns,
};

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const staffFixtures = {
  listLinkedAccounts() {
    return clone(mockDb.linkedAccounts);
  },
  listStaffRecords() {
    return clone(mockDb.staffRecords);
  },
  getStaffRecord(staffId: string) {
    return clone(mockDb.staffRecords.find((record) => record.id === staffId) || null);
  },
  createStaffRecord(payload: StaffRecord) {
    const record = { ...payload, id: nextId('staff') };
    mockDb.staffRecords.unshift(record);
    return clone(record);
  },
  updateStaffRecord(staffId: string, updates: Partial<StaffRecord>) {
    const index = mockDb.staffRecords.findIndex((record) => record.id === staffId);
    if (index === -1) return null;
    mockDb.staffRecords[index] = {
      ...mockDb.staffRecords[index],
      ...updates,
      financeSummary: {
        ...mockDb.staffRecords[index].financeSummary,
        ...(updates.financeSummary || {}),
      },
      recentTransactions: updates.recentTransactions || mockDb.staffRecords[index].recentTransactions,
    };
    return clone(mockDb.staffRecords[index]);
  },
  listLedger(staffId: string) {
    const record = mockDb.staffRecords.find((item) => item.id === staffId);
    return clone(record?.recentTransactions || []);
  },
  createLedgerEntry(staffId: string, entry: StaffRecord['recentTransactions'][number]) {
    const record = mockDb.staffRecords.find((item) => item.id === staffId);
    if (!record) return null;
    const nextEntry = { ...entry, id: nextId('ledger'), staffId };
    record.recentTransactions.unshift(nextEntry);
    return clone(nextEntry);
  },
  updateLedgerEntry(staffId: string, entryId: string, updates: Partial<StaffRecord['recentTransactions'][number]>) {
    const record = mockDb.staffRecords.find((item) => item.id === staffId);
    if (!record) return null;
    const index = record.recentTransactions.findIndex((item) => item.id === entryId);
    if (index === -1) return null;
    record.recentTransactions[index] = { ...record.recentTransactions[index], ...updates };
    return clone(record.recentTransactions[index]);
  },
  deleteLedgerEntry(staffId: string, entryId: string) {
    const record = mockDb.staffRecords.find((item) => item.id === staffId);
    if (!record) return false;
    record.recentTransactions = record.recentTransactions.filter((item) => item.id !== entryId);
    return true;
  },
  listShiftTemplates() {
    return clone(mockDb.shiftTemplates);
  },
  createShiftTemplate(payload: ShiftTemplate) {
    const template = { ...payload, id: nextId('shift') };
    mockDb.shiftTemplates.unshift(template);
    return clone(template);
  },
  updateShiftTemplate(templateId: string, updates: Partial<ShiftTemplate>) {
    const index = mockDb.shiftTemplates.findIndex((item) => item.id === templateId);
    if (index === -1) return null;
    mockDb.shiftTemplates[index] = { ...mockDb.shiftTemplates[index], ...updates };
    return clone(mockDb.shiftTemplates[index]);
  },
  deleteShiftTemplate(templateId: string) {
    mockDb.shiftTemplates = mockDb.shiftTemplates.filter((item) => item.id !== templateId);
    return true;
  },
  listShiftAssignments() {
    return clone(mockDb.shiftAssignments);
  },
  createShiftAssignments(payloads: ShiftAssignment[]) {
    const created = payloads.map((payload) => ({
      ...payload,
      id: nextId('assign'),
    }));
    mockDb.shiftAssignments.unshift(...created);
    return clone(created);
  },
  listAttendance() {
    return clone(mockDb.attendanceRecords);
  },
  updateAttendance(recordId: string, updates: Partial<AttendanceRecord>) {
    const index = mockDb.attendanceRecords.findIndex((item) => item.id === recordId);
    if (index === -1) return null;
    mockDb.attendanceRecords[index] = { ...mockDb.attendanceRecords[index], ...updates };
    return clone(mockDb.attendanceRecords[index]);
  },
  listOvertimePolicies() {
    return clone(mockDb.overtimePolicies);
  },
  listOvertimeSummary() {
    return clone(mockDb.overtimeSummary);
  },
  listLeaveRequests() {
    return clone(mockDb.leaveRequests);
  },
  listLeaveBalances() {
    return clone(mockDb.leaveBalances);
  },
  createLeaveRequest(payload: LeaveRequest) {
    const request = { ...payload, id: nextId('leave') };
    mockDb.leaveRequests.unshift(request);
    return clone(request);
  },
  updateLeaveRequest(requestId: string, updates: Partial<LeaveRequest>) {
    const index = mockDb.leaveRequests.findIndex((item) => item.id === requestId);
    if (index === -1) return null;
    mockDb.leaveRequests[index] = { ...mockDb.leaveRequests[index], ...updates };
    return clone(mockDb.leaveRequests[index]);
  },
  listPayrollRuns() {
    return clone(mockDb.payrollRuns);
  },
  getPayrollRun(runId: string) {
    return clone(mockDb.payrollRuns.find((item) => item.id === runId) || null);
  },
  createPayrollRun(payload: PayrollRun) {
    const run = { ...payload, id: nextId('payroll'), runCode: payload.runCode || `PAY-${dayjs().format('YYYYMMDDHHmm')}` };
    mockDb.payrollRuns.unshift(run);
    return clone(run);
  },
  updatePayrollRun(runId: string, updates: Partial<PayrollRun>) {
    const index = mockDb.payrollRuns.findIndex((item) => item.id === runId);
    if (index === -1) return null;
    mockDb.payrollRuns[index] = {
      ...mockDb.payrollRuns[index],
      ...updates,
      totals: {
        ...mockDb.payrollRuns[index].totals,
        ...(updates.totals || {}),
      },
      items: updates.items || mockDb.payrollRuns[index].items,
    };
    return clone(mockDb.payrollRuns[index]);
  },
};
