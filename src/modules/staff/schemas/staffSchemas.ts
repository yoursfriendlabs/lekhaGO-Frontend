import { z } from 'zod';

const requiredText = (message: string) => z.string().trim().min(1, message);

const nonNegativeNumber = (message: string) =>
  z.coerce.number({
    invalid_type_error: message,
  }).min(0, message);

export const staffRecordSchema = z.object({
  staffCode: requiredText('Staff code is required.'),
  fullName: requiredText('Full name is required.'),
  email: z.string().trim().email('Enter a valid email address.').or(z.literal('')),
  phone: z.string().trim().min(7, 'Phone number should be at least 7 digits.').or(z.literal('')),
  designation: requiredText('Designation is required.'),
  department: requiredText('Department is required.'),
  joinedOn: requiredText('Join date is required.'),
  salaryType: z.enum(['monthly', 'weekly', 'daily', 'hourly', 'commission', 'contract']),
  salaryAmount: nonNegativeNumber('Enter a valid salary amount.'),
  openingAdvanceBalance: nonNegativeNumber('Enter a valid opening advance balance.'),
  linkedMembershipId: z.string().trim().optional(),
  isActive: z.boolean(),
  notes: z.string().trim().max(1000, 'Keep notes under 1000 characters.'),
});

export const shiftTemplateSchema = z.object({
  shiftCode: requiredText('Shift code is required.'),
  name: requiredText('Shift name is required.'),
  startTime: requiredText('Start time is required.'),
  endTime: requiredText('End time is required.'),
  crossMidnight: z.boolean(),
  breakMinutes: nonNegativeNumber('Break minutes must be zero or more.'),
  graceMinutes: nonNegativeNumber('Grace minutes must be zero or more.'),
  overtimeThresholdMinutes: nonNegativeNumber('Overtime threshold must be zero or more.'),
  overtimeRounding: z.enum(['none', 'nearest_15', 'nearest_30', 'nearest_60']),
  overtimeMultiplier: z.coerce.number().min(1, 'Multiplier should be at least 1.'),
  isActive: z.boolean(),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one working day.'),
  color: requiredText('Pick a shift color.'),
});

export const shiftAssignmentSchema = z.object({
  staffIds: z.array(z.string().trim().min(1)).min(1, 'Select at least one staff member.'),
  shiftTemplateId: requiredText('Choose a shift template.'),
  dateFrom: requiredText('Start date is required.'),
  dateTo: requiredText('End date is required.'),
  weeklyOffDays: z.array(z.number().int().min(0).max(6)),
  note: z.string().trim().max(280, 'Keep notes under 280 characters.').optional(),
}).refine((values) => values.dateFrom <= values.dateTo, {
  message: 'End date must be after the start date.',
  path: ['dateTo'],
});

export const attendanceCorrectionSchema = z.object({
  status: z.enum(['present', 'absent', 'late', 'half_day', 'leave', 'holiday', 'week_off', 'on_duty']),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']),
  correctionReason: requiredText('Explain why the correction is needed.'),
});

export const leaveRequestSchema = z.object({
  staffId: requiredText('Choose a staff member.'),
  leaveType: z.enum(['casual', 'sick', 'annual', 'unpaid', 'emergency']),
  startDate: requiredText('Start date is required.'),
  endDate: requiredText('End date is required.'),
  reason: requiredText('Reason is required.'),
  note: z.string().trim().max(500, 'Keep notes under 500 characters.').optional(),
}).refine((values) => values.startDate <= values.endDate, {
  message: 'End date must be on or after the start date.',
  path: ['endDate'],
});

export const payrollRunSchema = z.object({
  title: requiredText('Payroll title is required.'),
  periodStart: requiredText('Period start is required.'),
  periodEnd: requiredText('Period end is required.'),
  payoutDate: requiredText('Payout date is required.'),
}).refine((values) => values.periodStart <= values.periodEnd, {
  message: 'Period end must be on or after period start.',
  path: ['periodEnd'],
});

export const ledgerEntrySchema = z.object({
  entryType: z.enum(['salary_payment', 'advance', 'advance_repayment']),
  amount: z.coerce.number().positive('Amount must be greater than zero.'),
  entryDate: requiredText('Entry date is required.'),
  referenceMonth: z.string().optional(),
  paymentMethod: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  note: z.string().trim().max(500, 'Keep notes under 500 characters.').optional(),
});

export type ValidationErrors = Record<string, string>;

export function toValidationErrors(error: z.ZodError): ValidationErrors {
  return error.issues.reduce<ValidationErrors>((accumulator, issue) => {
    const field = issue.path[0];
    if (typeof field === 'string' && !accumulator[field]) {
      accumulator[field] = issue.message;
    }

    return accumulator;
  }, {});
}
