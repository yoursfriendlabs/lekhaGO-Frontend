import dayjs from 'dayjs';
import type { PayrollRun, PayrollRunFormValues, ServiceResult } from '../types/staff';
import { staffFixtures } from '../data/fixtures';
import { buildStaffPath, requestJson, withMockFallback } from './client';

function normalizePayrollRun(entry: Record<string, unknown>): PayrollRun {
  return {
    id: String(entry.id || ''),
    runCode: String(entry.runCode || entry.code || ''),
    title: String(entry.title || ''),
    periodStart: String(entry.periodStart || ''),
    periodEnd: String(entry.periodEnd || ''),
    payoutDate: String(entry.payoutDate || ''),
    status: (entry.status || 'draft') as PayrollRun['status'],
    totals: {
      staffCount: Number(entry.totals?.staffCount || 0),
      grossAmount: Number(entry.totals?.grossAmount || 0),
      totalOvertime: Number(entry.totals?.totalOvertime || 0),
      totalDeductions: Number(entry.totals?.totalDeductions || 0),
      netPayable: Number(entry.totals?.netPayable || 0),
    },
    items: Array.isArray(entry.items) ? entry.items.map((item) => ({
      id: String(item.id || ''),
      staffId: String(item.staffId || ''),
      staffName: String(item.staffName || ''),
      designation: String(item.designation || ''),
      baseSalary: Number(item.baseSalary || 0),
      overtime: Number(item.overtime || 0),
      bonus: Number(item.bonus || 0),
      deductions: Number(item.deductions || 0),
      advanceRecovery: Number(item.advanceRecovery || 0),
      netPayable: Number(item.netPayable || 0),
      paymentStatus: (item.paymentStatus || 'pending') as PayrollRun['items'][number]['paymentStatus'],
    })) : [],
  };
}

function buildMockPayrollRun(values: PayrollRunFormValues): PayrollRun {
  const records = staffFixtures.listStaffRecords().filter((record) => record.isActive);
  const items = records.map((record) => ({
    id: '',
    staffId: record.id,
    staffName: record.fullName,
    designation: record.designation,
    baseSalary: record.salaryType === 'monthly' ? record.salaryAmount : record.salaryAmount * 22,
    overtime: 0,
    bonus: 0,
    deductions: 0,
    advanceRecovery: 0,
    netPayable: record.salaryType === 'monthly' ? record.salaryAmount : record.salaryAmount * 22,
    paymentStatus: 'pending' as const,
  }));

  return {
    id: '',
    runCode: `PAY-${dayjs(values.periodEnd).format('YYYY-MM')}`,
    title: values.title,
    periodStart: values.periodStart,
    periodEnd: values.periodEnd,
    payoutDate: values.payoutDate,
    status: 'draft',
    totals: {
      staffCount: items.length,
      grossAmount: items.reduce((total, item) => total + item.baseSalary + item.overtime + item.bonus, 0),
      totalOvertime: items.reduce((total, item) => total + item.overtime, 0),
      totalDeductions: items.reduce((total, item) => total + item.deductions + item.advanceRecovery, 0),
      netPayable: items.reduce((total, item) => total + item.netPayable, 0),
    },
    items,
  };
}

export const payrollService = {
  async listPayrollRuns(filters: { status: string; startDate: string; endDate: string }): Promise<ServiceResult<PayrollRun[]>> {
    return withMockFallback(
      async () => {
        const response = await requestJson<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>(
          buildStaffPath('/api/staff/payroll-runs', {
            status: filters.status === 'all' ? undefined : filters.status,
            from: filters.startDate || undefined,
            to: filters.endDate || undefined,
          }),
        );
        const items = Array.isArray(response) ? response : response.items || [];
        return items.map(normalizePayrollRun);
      },
      () =>
        staffFixtures
          .listPayrollRuns()
          .filter((item) => (filters.status !== 'all' ? item.status === filters.status : true))
          .filter((item) => (filters.startDate ? item.periodStart >= filters.startDate : true))
          .filter((item) => (filters.endDate ? item.periodEnd <= filters.endDate : true)),
    );
  },

  async getPayrollRun(runId: string): Promise<ServiceResult<PayrollRun>> {
    return withMockFallback(
      async () => normalizePayrollRun(await requestJson(`/api/staff/payroll-runs/${runId}`)),
      () => {
        const run = staffFixtures.getPayrollRun(runId);
        if (!run) throw new Error('Payroll run not found.');
        return run;
      },
    );
  },

  async createPayrollRun(values: PayrollRunFormValues) {
    return withMockFallback(
      async () => normalizePayrollRun(await requestJson('/api/staff/payroll-runs', {
        method: 'POST',
        body: JSON.stringify(values),
      })),
      () => staffFixtures.createPayrollRun(buildMockPayrollRun(values)),
    );
  },

  async updatePayrollRun(runId: string, values: Partial<PayrollRun>) {
    return withMockFallback(
      async () => normalizePayrollRun(await requestJson(`/api/staff/payroll-runs/${runId}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      })),
      () => staffFixtures.updatePayrollRun(runId, values)!,
    );
  },
};
