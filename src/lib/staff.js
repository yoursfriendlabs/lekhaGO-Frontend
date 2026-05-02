function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readFirstValue(source, keys = [], fallback = '') {
  const base = asObject(source);

  for (const key of keys) {
    const value = base?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
}

function readFirstString(source, keys = [], fallback = '') {
  const value = readFirstValue(source, keys, fallback);
  return String(value || '').trim();
}

function readFirstNumber(source, keys = [], fallback = 0) {
  for (const key of keys) {
    const parsed = Number(asObject(source)?.[key]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const parsedFallback = Number(fallback);
  return Number.isFinite(parsedFallback) ? parsedFallback : 0;
}

function readFirstBoolean(source, keys = [], fallback = true) {
  for (const key of keys) {
    const value = asObject(source)?.[key];
    if (value === true || value === false) {
      return value;
    }
  }

  return fallback;
}

function extractArray(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  const base = asObject(payload);
  for (const key of keys) {
    if (Array.isArray(base?.[key])) {
      return base[key];
    }
  }

  return [];
}

function normalizeCollection(payload, itemKeys = []) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      limit: payload.length,
      offset: 0,
    };
  }

  const base = asObject(payload);
  const items = extractArray(base, itemKeys);

  return {
    ...base,
    items,
    total: Number(base.total ?? base.count ?? base.totalCount ?? items.length),
    limit: Number(base.limit ?? base.pagination?.limit ?? items.length),
    offset: Number(base.offset ?? base.pagination?.offset ?? 0),
  };
}

export function normalizeStaffMember(member = {}) {
  const source = asObject(member);
  const nestedUser = [
    source.user,
    source.User,
    source.member,
    source.account,
    source.profile,
  ].find((value) => value && typeof value === 'object' && !Array.isArray(value)) || {};

  const user = {
    ...nestedUser,
    id: readFirstString(nestedUser, ['id', '_id', 'userId'], readFirstString(source, ['userId'])),
    name: readFirstString(nestedUser, ['name', 'fullName'], readFirstString(source, ['name', 'fullName'])),
    email: readFirstString(nestedUser, ['email'], readFirstString(source, ['email'])),
    phone: readFirstString(nestedUser, ['phone'], readFirstString(source, ['phone'])),
    role: readFirstString(nestedUser, ['role'], readFirstString(source, ['role'], 'staff')),
    emailVerified: readFirstValue(nestedUser, ['emailVerified'], readFirstValue(source, ['emailVerified'], null)),
    isActive: readFirstBoolean(nestedUser, ['isActive'], readFirstBoolean(source, ['isActive'], true)),
  };

  return {
    ...source,
    membershipId: readFirstString(source, ['membershipId', 'id', '_id', 'memberId'], user.id || user.email || ''),
    role: readFirstString(source, ['role', 'memberRole'], user.role || 'staff'),
    joinedAt: readFirstValue(source, ['joinedAt', 'createdAt', 'updatedAt'], readFirstValue(nestedUser, ['createdAt', 'updatedAt'], '')),
    user,
  };
}

export function normalizeStaffMembersPayload(payload = {}) {
  const base = asObject(payload);
  const members = extractArray(base, ['members', 'items', 'rows', 'results', 'data', 'staff']).map(normalizeStaffMember);
  const summarySource = asObject(base.summary);
  const totalUsers = Number(summarySource.totalUsers ?? summarySource.usedSeats ?? base.totalUsers ?? base.count ?? members.length);
  const maxUsers = Number(summarySource.maxUsers ?? summarySource.totalSeats ?? base.maxUsers ?? totalUsers);
  const availableSlots = Number(
    summarySource.availableSlots ??
    summarySource.remainingSeats ??
    base.availableSlots ??
    Math.max(maxUsers - totalUsers, 0)
  );

  return {
    ...base,
    members,
    summary: {
      ...summarySource,
      totalUsers: Number.isFinite(totalUsers) ? totalUsers : members.length,
      maxUsers: Number.isFinite(maxUsers) ? maxUsers : members.length,
      availableSlots: Number.isFinite(availableSlots) ? availableSlots : 0,
    },
  };
}

export function getStaffMemberOption(member = {}) {
  const normalized = normalizeStaffMember(member);
  const value = normalized.membershipId;
  if (!value) return null;

  const parts = [
    normalized.user?.name,
    normalized.user?.email,
    normalized.user?.phone,
  ].filter(Boolean);

  return {
    value,
    label: parts.length > 0 ? parts.join(' · ') : value,
    member: normalized,
  };
}

export function normalizeStaffRecord(record = {}) {
  const source = asObject(record);
  const finance = [
    source.financeSummary,
    source.finance,
    source.summary,
    source.payroll,
  ].find((value) => value && typeof value === 'object' && !Array.isArray(value)) || {};
  const linkedMembership = [
    source.linkedMembership,
    source.linkedMember,
    source.member,
    source.membership,
  ].find((value) => value && typeof value === 'object' && !Array.isArray(value)) || null;
  const linkedMember = linkedMembership ? normalizeStaffMember(linkedMembership) : null;

  const linkedUser = linkedMember?.user || {};

  return {
    ...source,
    id: readFirstString(
      source,
      ['id', '_id', 'staffId'],
      readFirstString(source, ['staffCode', 'code', 'employeeCode'], readFirstString(source, ['linkedMembershipId', 'membershipId']))
    ),
    linkedMembershipId: readFirstString(source, ['linkedMembershipId', 'membershipId', 'linkedMemberId'], linkedMember?.membershipId || ''),
    linkedMember,
    staffCode: readFirstString(source, ['staffCode', 'code', 'employeeCode']),
    fullName: readFirstString(source, ['fullName', 'name'], linkedUser.name || ''),
    phone: readFirstString(source, ['phone'], linkedUser.phone || ''),
    email: readFirstString(source, ['email'], linkedUser.email || ''),
    designation: readFirstString(source, ['designation', 'jobTitle']),
    department: readFirstString(source, ['department', 'team']),
    joinedOn: readFirstValue(source, ['joinedOn', 'joinDate', 'joiningDate', 'dateOfJoin'], ''),
    salaryType: readFirstString(source, ['salaryType', 'payType']),
    salaryAmount: readFirstNumber(source, ['salaryAmount', 'salary', 'salaryRate']),
    openingAdvanceBalance: readFirstNumber(source, ['openingAdvanceBalance', 'openingAdvance'], readFirstNumber(finance, ['openingAdvanceBalance', 'openingAdvance'])),
    totalSalaryPaid: readFirstNumber(source, ['totalSalaryPaid'], readFirstNumber(finance, ['totalSalaryPaid'])),
    totalAdvanceGiven: readFirstNumber(source, ['totalAdvanceGiven'], readFirstNumber(finance, ['totalAdvanceGiven'])),
    totalAdvanceRepaid: readFirstNumber(source, ['totalAdvanceRepaid'], readFirstNumber(finance, ['totalAdvanceRepaid'])),
    outstandingAdvanceBalance: readFirstNumber(source, ['outstandingAdvanceBalance'], readFirstNumber(finance, ['outstandingAdvanceBalance'])),
    isActive: readFirstBoolean(source, ['isActive'], true),
    notes: readFirstString(source, ['notes', 'note']),
    createdAt: readFirstValue(source, ['createdAt'], ''),
    updatedAt: readFirstValue(source, ['updatedAt'], ''),
  };
}

export function normalizeStaffRecordsPayload(payload = {}) {
  const collection = normalizeCollection(payload, ['items', 'rows', 'results', 'data', 'records', 'staffRecords']);

  return {
    ...collection,
    items: collection.items.map(normalizeStaffRecord),
  };
}

export function normalizeStaffLedgerEntry(entry = {}) {
  const source = asObject(entry);
  const bank = asObject(source.bank);

  return {
    ...source,
    id: readFirstString(
      source,
      ['id', '_id', 'entryId'],
      [source.entryType, source.entryDate || source.date || source.createdAt, source.amount]
        .filter(Boolean)
        .join(':')
    ),
    entryType: readFirstString(source, ['entryType', 'type']),
    amount: readFirstNumber(source, ['amount', 'value']),
    entryDate: readFirstValue(source, ['entryDate', 'date', 'paidOn', 'createdAt'], ''),
    referenceMonth: readFirstString(source, ['referenceMonth', 'month']),
    paymentMethod: readFirstString(source, ['paymentMethod', 'paymentType'], bank.id ? 'bank' : 'cash'),
    bankId: readFirstString(source, ['bankId'], readFirstString(bank, ['id', '_id'])),
    bankName: readFirstString(source, ['bankName'], readFirstString(bank, ['name'])),
    note: readFirstString(source, ['note', 'paymentNote', 'description']),
  };
}

export function normalizeStaffLedgerPayload(payload = {}) {
  const collection = normalizeCollection(payload, ['items', 'rows', 'results', 'data', 'entries', 'ledger']);

  return {
    ...collection,
    items: collection.items.map(normalizeStaffLedgerEntry),
  };
}

export const STAFF_SALARY_TYPE_OPTIONS = [
  'monthly',
  'weekly',
  'daily',
  'hourly',
  'commission',
  'contract',
];

export const STAFF_LEDGER_ENTRY_TYPES = [
  'salary_payment',
  'advance',
  'advance_repayment',
];
