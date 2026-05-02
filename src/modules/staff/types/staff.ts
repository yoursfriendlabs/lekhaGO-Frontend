export type ApiDataSource = 'live' | 'mock';

export type SalaryType =
  | 'monthly'
  | 'weekly'
  | 'daily'
  | 'hourly'
  | 'commission'
  | 'contract';

export type StaffEntryType = 'salary_payment' | 'advance' | 'advance_repayment';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'half_day'
  | 'leave'
  | 'holiday'
  | 'week_off'
  | 'on_duty';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type OvertimeRounding = 'none' | 'nearest_15' | 'nearest_30' | 'nearest_60';

export type LeaveType = 'casual' | 'sick' | 'annual' | 'unpaid' | 'emergency';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type PayrollRunStatus = 'draft' | 'calculated' | 'approved' | 'paid';

export type PaymentStatus = 'pending' | 'processing' | 'paid';

export interface ServiceResult<T> {
  data: T;
  source: ApiDataSource;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface OptionItem {
  value: string;
  label: string;
}

export interface LinkedAccount {
  membershipId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  emailVerified?: boolean | null;
}

export interface FinanceSummary {
  openingAdvanceBalance: number;
  totalSalaryPaid: number;
  totalAdvanceGiven: number;
  totalAdvanceRepaid: number;
  outstandingAdvanceBalance: number;
}

export interface LedgerEntry {
  id: string;
  staffId: string;
  entryType: StaffEntryType;
  amount: number;
  entryDate: string;
  referenceMonth?: string;
  paymentMethod?: string;
  bankName?: string;
  note?: string;
}

export interface StaffRecord {
  id: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  joinedOn: string;
  salaryType: SalaryType;
  salaryAmount: number;
  isActive: boolean;
  notes: string;
  linkedMembershipId?: string;
  linkedAccount?: LinkedAccount | null;
  financeSummary: FinanceSummary;
  recentTransactions: LedgerEntry[];
}

export interface StaffDirectoryFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  department: string;
  designation: string;
  salaryType: 'all' | SalaryType;
  page: number;
  pageSize: number;
}

export interface StaffDirectorySummary {
  totalStaff: number;
  activeStaff: number;
  salaryCommitment: number;
  outstandingAdvanceBalance: number;
}

export interface ShiftTemplate {
  id: string;
  shiftCode: string;
  name: string;
  startTime: string;
  endTime: string;
  crossMidnight: boolean;
  breakMinutes: number;
  graceMinutes: number;
  overtimeThresholdMinutes: number;
  overtimeRounding: OvertimeRounding;
  overtimeMultiplier: number;
  isActive: boolean;
  workingDays: number[];
  color: string;
}

export interface ShiftAssignment {
  id: string;
  staffId: string;
  staffName: string;
  shiftTemplateId: string;
  shiftName: string;
  dateFrom: string;
  dateTo: string;
  weeklyOffDays: number[];
  note?: string;
}

export interface RosterCell {
  date: string;
  dayLabel: string;
  shiftName?: string;
  shiftTime?: string;
  color?: string;
  isWeekOff?: boolean;
  hasConflict?: boolean;
  notes?: string;
}

export interface RosterRow {
  staffId: string;
  staffName: string;
  department: string;
  designation: string;
  cells: RosterCell[];
}

export interface RosterSnapshot {
  viewMode: 'week' | 'month';
  focusDate: string;
  days: { date: string; label: string; weekend: boolean }[];
  rows: RosterRow[];
  conflicts: string[];
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  department: string;
  designation: string;
  attendanceDate: string;
  shiftName: string;
  clockIn?: string;
  clockOut?: string;
  workedHours: number;
  lateMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
  approvalStatus: ApprovalStatus;
  correctionReason?: string;
  notes?: string;
}

export interface AttendanceFilters {
  search: string;
  staffId: string;
  department: string;
  status: 'all' | AttendanceStatus;
  startDate: string;
  endDate: string;
}

export interface OvertimePolicy {
  id: string;
  name: string;
  effectiveFrom: string;
  thresholdMinutes: number;
  rounding: OvertimeRounding;
  multiplier: number;
  isActive: boolean;
}

export interface OvertimeSummaryItem {
  staffId: string;
  staffName: string;
  department: string;
  scheduledHours: number;
  workedHours: number;
  overtimeHours: number;
  approvedOvertimeHours: number;
  overtimeAmount: number;
  approvalStatus: ApprovalStatus;
}

export interface LeaveBalance {
  leaveType: LeaveType;
  total: number;
  used: number;
  remaining: number;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  department: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  requestedAt: string;
  approverName?: string;
  note?: string;
}

export interface PayrollItem {
  id: string;
  staffId: string;
  staffName: string;
  designation: string;
  baseSalary: number;
  overtime: number;
  bonus: number;
  deductions: number;
  advanceRecovery: number;
  netPayable: number;
  paymentStatus: PaymentStatus;
}

export interface PayrollRun {
  id: string;
  runCode: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  payoutDate: string;
  status: PayrollRunStatus;
  totals: {
    staffCount: number;
    grossAmount: number;
    totalOvertime: number;
    totalDeductions: number;
    netPayable: number;
  };
  items: PayrollItem[];
}

export interface PayrollRunFilters {
  status: 'all' | PayrollRunStatus;
  startDate: string;
  endDate: string;
}

export interface StaffFormValues {
  staffCode: string;
  fullName: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  joinedOn: string;
  salaryType: SalaryType;
  salaryAmount: number;
  openingAdvanceBalance: number;
  linkedMembershipId?: string;
  isActive: boolean;
  notes: string;
}

export interface ShiftTemplateFormValues {
  shiftCode: string;
  name: string;
  startTime: string;
  endTime: string;
  crossMidnight: boolean;
  breakMinutes: number;
  graceMinutes: number;
  overtimeThresholdMinutes: number;
  overtimeRounding: OvertimeRounding;
  overtimeMultiplier: number;
  isActive: boolean;
  workingDays: number[];
  color: string;
}

export interface ShiftAssignmentFormValues {
  staffIds: string[];
  shiftTemplateId: string;
  dateFrom: string;
  dateTo: string;
  weeklyOffDays: number[];
  note?: string;
}

export interface AttendanceCorrectionValues {
  status: AttendanceStatus;
  clockIn?: string;
  clockOut?: string;
  approvalStatus: ApprovalStatus;
  correctionReason: string;
}

export interface LeaveRequestFormValues {
  staffId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  note?: string;
}

export interface PayrollRunFormValues {
  title: string;
  periodStart: string;
  periodEnd: string;
  payoutDate: string;
}

export interface LedgerEntryFormValues {
  entryType: StaffEntryType;
  amount: number;
  entryDate: string;
  referenceMonth?: string;
  paymentMethod?: string;
  bankName?: string;
  note?: string;
}
