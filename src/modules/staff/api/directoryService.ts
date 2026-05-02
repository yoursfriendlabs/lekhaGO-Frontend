import { api } from '../../../lib/api';
import type {
  LedgerEntry,
  LedgerEntryFormValues,
  LinkedAccount,
  PaginatedResult,
  ServiceResult,
  StaffDirectoryFilters,
  StaffDirectorySummary,
  StaffFormValues,
  StaffRecord,
} from '../types/staff';
import { staffFixtures } from '../data/fixtures';
import { withMockFallback } from './client';

function toLinkedAccount(value: Record<string, unknown>): LinkedAccount {
  return {
    membershipId: String(value.membershipId || value.id || value.userId || ''),
    name: String(value.user?.name || value.name || ''),
    email: String(value.user?.email || value.email || ''),
    phone: String(value.user?.phone || value.phone || ''),
    role: String(value.role || value.user?.role || 'staff'),
    isActive: Boolean(value.user?.isActive ?? value.isActive ?? true),
    emailVerified: typeof value.user?.emailVerified === 'boolean' ? value.user?.emailVerified : null,
  };
}

function toFinanceSummary(record: Record<string, unknown>) {
  return {
    openingAdvanceBalance: Number(record.openingAdvanceBalance || 0),
    totalSalaryPaid: Number(record.totalSalaryPaid || 0),
    totalAdvanceGiven: Number(record.totalAdvanceGiven || 0),
    totalAdvanceRepaid: Number(record.totalAdvanceRepaid || 0),
    outstandingAdvanceBalance: Number(record.outstandingAdvanceBalance || 0),
  };
}

function normalizeLedgerEntry(staffId: string, entry: Record<string, unknown>): LedgerEntry {
  return {
    id: String(entry.id || entry.entryId || ''),
    staffId,
    entryType: (entry.entryType || 'salary_payment') as LedgerEntry['entryType'],
    amount: Number(entry.amount || 0),
    entryDate: String(entry.entryDate || entry.date || ''),
    referenceMonth: String(entry.referenceMonth || entry.month || ''),
    paymentMethod: String(entry.paymentMethod || ''),
    bankName: String(entry.bankName || ''),
    note: String(entry.note || ''),
  };
}

function normalizeStaffRecord(record: Record<string, unknown>): StaffRecord {
  const linkedMember = record.linkedMember as Record<string, unknown> | undefined;
  const ledgerItems = Array.isArray(record.recentTransactions)
    ? record.recentTransactions as Record<string, unknown>[]
    : [];

  return {
    id: String(record.id || ''),
    staffCode: String(record.staffCode || ''),
    fullName: String(record.fullName || ''),
    email: String(record.email || ''),
    phone: String(record.phone || ''),
    designation: String(record.designation || ''),
    department: String(record.department || ''),
    joinedOn: String(record.joinedOn || ''),
    salaryType: (record.salaryType || 'monthly') as StaffRecord['salaryType'],
    salaryAmount: Number(record.salaryAmount || 0),
    isActive: Boolean(record.isActive ?? true),
    notes: String(record.notes || ''),
    linkedMembershipId: String(record.linkedMembershipId || ''),
    linkedAccount: linkedMember ? toLinkedAccount(linkedMember) : null,
    financeSummary: toFinanceSummary(record),
    recentTransactions: ledgerItems.map((entry) => normalizeLedgerEntry(String(record.id || ''), entry)),
  };
}

function applyDirectoryFilters(items: StaffRecord[], filters: StaffDirectoryFilters) {
  const normalizedQuery = filters.search.trim().toLowerCase();

  return items.filter((record) => {
    if (filters.status === 'active' && !record.isActive) return false;
    if (filters.status === 'inactive' && record.isActive) return false;
    if (filters.department && record.department !== filters.department) return false;
    if (filters.designation && record.designation !== filters.designation) return false;
    if (filters.salaryType !== 'all' && record.salaryType !== filters.salaryType) return false;

    if (!normalizedQuery) return true;

    return [
      record.fullName,
      record.staffCode,
      record.phone,
      record.designation,
      record.department,
      record.email,
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

function toSummary(items: StaffRecord[]): StaffDirectorySummary {
  return {
    totalStaff: items.length,
    activeStaff: items.filter((record) => record.isActive).length,
    salaryCommitment: items.reduce((total, record) => total + Number(record.salaryAmount || 0), 0),
    outstandingAdvanceBalance: items.reduce(
      (total, record) => total + Number(record.financeSummary.outstandingAdvanceBalance || 0),
      0,
    ),
  };
}

export const directoryService = {
  async listStaffDirectory(filters: StaffDirectoryFilters): Promise<ServiceResult<{ records: PaginatedResult<StaffRecord>; summary: StaffDirectorySummary }>> {
    return withMockFallback(
      async () => {
        const response = await api.listStaffRecords({
          search: filters.search || undefined,
          isActive: filters.status === 'all' ? undefined : filters.status === 'active',
          department: filters.department || undefined,
          designation: filters.designation || undefined,
          salaryType: filters.salaryType === 'all' ? undefined : filters.salaryType,
          limit: filters.pageSize,
          offset: (filters.page - 1) * filters.pageSize,
        });

        const records = (response.items || []).map((item: Record<string, unknown>) => normalizeStaffRecord(item));

        return {
          records: {
            items: records,
            total: Number(response.total || records.length),
            limit: Number(response.limit || filters.pageSize),
            offset: Number(response.offset || 0),
          },
          summary: toSummary(records),
        };
      },
      () => {
        const filtered = applyDirectoryFilters(staffFixtures.listStaffRecords(), filters);
        const start = (filters.page - 1) * filters.pageSize;
        const items = filtered.slice(start, start + filters.pageSize);

        return {
          records: {
            items,
            total: filtered.length,
            limit: filters.pageSize,
            offset: start,
          },
          summary: toSummary(filtered),
        };
      },
    );
  },

  async listLinkedAccounts() {
    return withMockFallback(
      async () => {
        const response = await api.listStaffMembers();
        return (response.members || []).map((member: Record<string, unknown>) => toLinkedAccount(member));
      },
      () => staffFixtures.listLinkedAccounts(),
    );
  },

  async getStaffRecord(staffId: string) {
    return withMockFallback(
      async () => normalizeStaffRecord(await api.getStaffRecord(staffId)),
      () => {
        const record = staffFixtures.getStaffRecord(staffId);
        if (!record) {
          throw new Error('Staff record not found.');
        }
        return record;
      },
    );
  },

  async createStaffRecord(values: StaffFormValues) {
    return withMockFallback(
      async () => normalizeStaffRecord(await api.createStaffRecord(values)),
      () =>
        staffFixtures.createStaffRecord({
          id: '',
          ...values,
          linkedAccount: values.linkedMembershipId
            ? staffFixtures.listLinkedAccounts().find((account) => account.membershipId === values.linkedMembershipId) || null
            : null,
          financeSummary: {
            openingAdvanceBalance: values.openingAdvanceBalance,
            totalSalaryPaid: 0,
            totalAdvanceGiven: 0,
            totalAdvanceRepaid: 0,
            outstandingAdvanceBalance: values.openingAdvanceBalance,
          },
          recentTransactions: [],
        }),
    );
  },

  async updateStaffRecord(staffId: string, values: Partial<StaffFormValues>) {
    return withMockFallback(
      async () => normalizeStaffRecord(await api.updateStaffRecord(staffId, values)),
      () =>
        staffFixtures.updateStaffRecord(staffId, {
          ...values,
          linkedAccount: values.linkedMembershipId
            ? staffFixtures.listLinkedAccounts().find((account) => account.membershipId === values.linkedMembershipId) || null
            : undefined,
          financeSummary: values.openingAdvanceBalance !== undefined
            ? {
                openingAdvanceBalance: values.openingAdvanceBalance,
                totalSalaryPaid: staffFixtures.getStaffRecord(staffId)?.financeSummary.totalSalaryPaid || 0,
                totalAdvanceGiven: staffFixtures.getStaffRecord(staffId)?.financeSummary.totalAdvanceGiven || 0,
                totalAdvanceRepaid: staffFixtures.getStaffRecord(staffId)?.financeSummary.totalAdvanceRepaid || 0,
                outstandingAdvanceBalance:
                  staffFixtures.getStaffRecord(staffId)?.financeSummary.outstandingAdvanceBalance || 0,
              }
            : undefined,
        })!,
    );
  },

  async deactivateStaffRecord(staffId: string, nextStatus: boolean) {
    return this.updateStaffRecord(staffId, { isActive: nextStatus });
  },

  async listLedgerEntries(staffId: string) {
    return withMockFallback(
      async () => {
        const response = await api.listStaffLedger(staffId, { limit: 100, offset: 0 });
        return response.items.map((item: Record<string, unknown>) => normalizeLedgerEntry(staffId, item));
      },
      () => staffFixtures.listLedger(staffId),
    );
  },

  async createLedgerEntry(staffId: string, values: LedgerEntryFormValues) {
    return withMockFallback(
      async () => normalizeLedgerEntry(staffId, await api.createStaffLedgerEntry(staffId, values)),
      () =>
        staffFixtures.createLedgerEntry(staffId, {
          id: '',
          staffId,
          ...values,
        })!,
    );
  },

  async updateLedgerEntry(staffId: string, entryId: string, values: Partial<LedgerEntryFormValues>) {
    return withMockFallback(
      async () => normalizeLedgerEntry(staffId, await api.updateStaffLedgerEntry(staffId, entryId, values)),
      () => staffFixtures.updateLedgerEntry(staffId, entryId, values as Partial<LedgerEntry>)!,
    );
  },

  async deleteLedgerEntry(staffId: string, entryId: string) {
    return withMockFallback(
      async () => {
        await api.deleteStaffLedgerEntry(staffId, entryId);
        return true;
      },
      () => staffFixtures.deleteLedgerEntry(staffId, entryId),
    );
  },
};
