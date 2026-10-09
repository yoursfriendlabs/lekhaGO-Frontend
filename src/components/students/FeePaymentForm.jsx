import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { useAuth } from '@/lib/auth';
import { todayISODate } from '@/lib/dates/datetime';
import { toAmount } from '@/lib/students';
import Notice from '@/components/ui/Notice';
import PaymentMethodFields from '@/components/form/PaymentMethodFields';
import { Field, FormActions, StudentDialog, useStudentFormat } from './StudentUi';

export default function FeePaymentForm({ enrollment, onClose, onSaved }) {
  const { t } = useI18n();
  const { canViewFeature } = useAuth();
  const money = useStudentFormat();
  const [form, setForm] = useState({ amount: '', txDate: todayISODate(), paymentMethod: 'cash', bankId: '', paymentNote: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const due = Number(enrollment.fees?.due || 0);
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const amount = toAmount(form.amount);
    if (amount <= 0 || amount > due) { setError(t('students.validation.payment', { due: money(due) })); return; }
    if (form.paymentMethod === 'bank' && !form.bankId) { setError(t('payments.bankRequired')); return; }
    setBusy(true); setError('');
    try {
      const result = await api.collectEnrollmentFee(enrollment.id, {
        amount, txDate: form.txDate, paymentMethod: form.paymentMethod,
        bankId: form.paymentMethod === 'bank' ? form.bankId : null, note: form.paymentNote,
      });
      onSaved(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <StudentDialog title={t('students.fees.collect')} onClose={onClose} busy={busy} size="lg">
    <form className="space-y-5" onSubmit={save}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-medium text-ink">{enrollment.student?.name}</p><p className="text-sm text-secondary-500">{enrollment.course?.name}</p></div>
        <div className="text-right"><p className="text-xs text-secondary-500">{t('students.fees.due')}</p><p className="font-semibold text-amber-700">{money(due)}</p></div>
      </div>
      <Notice title={t('students.fees.allocationTitle')} description={t('students.fees.allocationHint')} />
      {error && <div role="alert"><Notice tone="error" title={error} /></div>}
      <fieldset disabled={busy} className="space-y-4">
        <Field label={t('students.fees.amount')}>
          <div className="flex gap-2">
            <input className="input min-w-0 flex-1" type="number" min="0.01" max={due} step="0.01" required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => setForm((current) => ({ ...current, amount: due }))}>{t('students.fees.fullDue')}</button>
          </div>
        </Field>
        <Field label={t('students.fees.paymentDate')}><input className="input" type="date" required value={form.txDate} onChange={(event) => setForm((current) => ({ ...current, txDate: event.target.value }))} /></Field>
        <PaymentMethodFields value={form} onChange={(payment) => setForm((current) => ({ ...current, ...payment }))} showPaymentNote allowBankPayments={canViewFeature('banks')} />
      </fieldset>
      <FormActions busy={busy} onClose={onClose} label={t('students.fees.record')} />
    </form>
  </StudentDialog>;
}
