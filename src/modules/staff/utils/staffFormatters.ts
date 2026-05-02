import dayjs from 'dayjs';
import type { ApprovalStatus, AttendanceStatus, LeaveStatus, PaymentStatus, PayrollRunStatus, SalaryType, StaffEntryType } from '../types/staff';

export function formatMoney(amount: number, currencySymbol = 'Rs') {
  return new Intl.NumberFormat('en-NP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount).reduce((accumulator, part) => accumulator + part.value, `${currencySymbol} `);
}

export function formatDate(value?: string, fallback = '—') {
  if (!value) return fallback;
  const date = dayjs(value);
  return date.isValid() ? date.format('MMM D, YYYY') : fallback;
}

export function formatShortDate(value?: string, fallback = '—') {
  if (!value) return fallback;
  const date = dayjs(value);
  return date.isValid() ? date.format('D MMM') : fallback;
}

export function formatMonth(value?: string, fallback = '—') {
  if (!value) return fallback;
  const date = dayjs(value);
  return date.isValid() ? date.format('MMM YYYY') : fallback;
}

export function formatHours(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${normalized.toFixed(1)}h`;
}

export function formatMinutes(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${Math.round(normalized)}m`;
}

export function formatDateTime(value?: string, fallback = '—') {
  if (!value) return fallback;
  const date = dayjs(value);
  return date.isValid() ? date.format('MMM D, YYYY h:mm A') : fallback;
}

export function salaryTypeLabel(value: SalaryType | string) {
  const labels: Record<string, string> = {
    monthly: 'Monthly',
    weekly: 'Weekly',
    daily: 'Daily',
    hourly: 'Hourly',
    commission: 'Commission',
    contract: 'Contract',
  };

  return labels[value] || value || '—';
}

export function entryTypeLabel(value: StaffEntryType | string) {
  const labels: Record<string, string> = {
    salary_payment: 'Salary payment',
    advance: 'Advance',
    advance_repayment: 'Advance repayment',
  };

  return labels[value] || value || '—';
}

export function attendanceStatusLabel(value: AttendanceStatus | string) {
  const labels: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    half_day: 'Half day',
    leave: 'Leave',
    holiday: 'Holiday',
    week_off: 'Week off',
    on_duty: 'On duty',
  };

  return labels[value] || value || '—';
}

export function approvalStatusLabel(value: ApprovalStatus | string) {
  const labels: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  return labels[value] || value || '—';
}

export function leaveStatusLabel(value: LeaveStatus | string) {
  const labels: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

  return labels[value] || value || '—';
}

export function payrollStatusLabel(value: PayrollRunStatus | string) {
  const labels: Record<string, string> = {
    draft: 'Draft',
    calculated: 'Calculated',
    approved: 'Approved',
    paid: 'Paid',
  };

  return labels[value] || value || '—';
}

export function paymentStatusLabel(value: PaymentStatus | string) {
  const labels: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    paid: 'Paid',
  };

  return labels[value] || value || '—';
}

export function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '—';

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function toIsoDate(value: string | Date) {
  return dayjs(value).format('YYYY-MM-DD');
}
