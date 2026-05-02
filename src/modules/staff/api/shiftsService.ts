import type { ServiceResult, ShiftTemplate, ShiftTemplateFormValues } from '../types/staff';
import { staffFixtures } from '../data/fixtures';
import { requestJson, withMockFallback } from './client';

function normalizeTemplate(template: Record<string, unknown>): ShiftTemplate {
  return {
    id: String(template.id || ''),
    shiftCode: String(template.shiftCode || template.code || ''),
    name: String(template.name || ''),
    startTime: String(template.startTime || ''),
    endTime: String(template.endTime || ''),
    crossMidnight: Boolean(template.crossMidnight),
    breakMinutes: Number(template.breakMinutes || 0),
    graceMinutes: Number(template.graceMinutes || 0),
    overtimeThresholdMinutes: Number(template.overtimeThresholdMinutes || template.overtimeThreshold || 0),
    overtimeRounding: (template.overtimeRounding || 'none') as ShiftTemplate['overtimeRounding'],
    overtimeMultiplier: Number(template.overtimeMultiplier || 1),
    isActive: Boolean(template.isActive ?? true),
    workingDays: Array.isArray(template.workingDays) ? template.workingDays.map(Number) : [],
    color: String(template.color || '#9b6835'),
  };
}

export const shiftsService = {
  async listShiftTemplates(): Promise<ServiceResult<ShiftTemplate[]>> {
    return withMockFallback(
      async () => {
        const response = await requestJson<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>('/api/staff/shifts');
        const items = Array.isArray(response) ? response : response.items || [];
        return items.map(normalizeTemplate);
      },
      () => staffFixtures.listShiftTemplates(),
    );
  },

  async createShiftTemplate(values: ShiftTemplateFormValues) {
    return withMockFallback(
      async () => normalizeTemplate(await requestJson('/api/staff/shifts', { method: 'POST', body: JSON.stringify(values) })),
      () => staffFixtures.createShiftTemplate({ id: '', ...values }),
    );
  },

  async updateShiftTemplate(templateId: string, values: Partial<ShiftTemplateFormValues>) {
    return withMockFallback(
      async () => normalizeTemplate(await requestJson(`/api/staff/shifts/${templateId}`, { method: 'PATCH', body: JSON.stringify(values) })),
      () => staffFixtures.updateShiftTemplate(templateId, values)!,
    );
  },

  async deleteShiftTemplate(templateId: string) {
    return withMockFallback(
      async () => {
        await requestJson(`/api/staff/shifts/${templateId}`, { method: 'DELETE' });
        return true;
      },
      () => staffFixtures.deleteShiftTemplate(templateId),
    );
  },
};
