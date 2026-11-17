import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice';
import PaymentMethodFields from '@/components/form/PaymentMethodFields.jsx';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { useBusinessSettings } from '@/lib/business/businessSettings';
import { formatMoney } from '@/lib/money/formatting';
import { buildPaymentPayload, requiresBankSelection } from '@/lib/money/payments';
import { printElement } from '@/lib/print/print';
import { compact, displayDate, todayISO, toNumber } from '@/lib/students/utils';
import { useStudentsModule } from './useStudentsModule';

function emptyForm() {
  return { amount: '', txDate: todayISO(), paymentMethod: 'cash', bankId: '', note: '' };
}

/**
 * Collect an installment on one enrollment.
 * The server applies it to the customer's oldest unpaid bill, so the due
 * shown afterwards always comes from the response.
 */
export default function CollectFeeDialog({ isOpen, enrollment, studentName, onClose, onPaid }) {
  const { t } = useI18n();
  const { settings } = useBusinessSettings();
  const { handleError } = useStudentsModule();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyForm());
    setError('');
    setResult(null);
  }, [isOpen, enrollment?.id]);

  const due = toNumber(enrollment?.fees?.due);
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const amount = toNumber(form.amount);
    if (amount <= 0) {
      setError(t('students.fee.amountRequired'));
      return;
    }
    if (amount > due) {
      setError(t('students.fee.amountTooHigh'));
      return;
    }
    if (requiresBankSelection(form, amount)) {
      setError(t('payments.bankRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await api.collectStudentFee(enrollment.id, compact({
        amount,
        txDate: form.txDate || undefined,
        note: form.note.trim() || undefined,
        ...buildPaymentPayload({ paymentMethod: form.paymentMethod, bankId: form.bankId }),
      }));
      setResult({ amount, ...response });
      onPaid?.(response);
    } catch (err) {
      const text = handleError(err);
      if (text) setError(text);
    } finally {
      setSaving(false);
    }
  };

  const dueAfter = toNumber(result?.enrollment?.fees?.due ?? due);
  const method = result?.payment?.paymentMethod || form.paymentMethod;

  const footer = result ? (
    <div className="flex justify-end gap-2">
      <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => printElement(receiptRef.current)}>
        <Printer size={16} />
        {t('students.fee.printReceipt')}
      </button>
      <button type="button" className="btn-primary" onClick={onClose}>{t('common.close')}</button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
      <button type="submit" form="collect-fee-form" className="btn-primary" disabled={saving || due <= 0}>
        {saving ? t('common.saving') : t('students.fee.submit')}
      </button>
    </div>
  );

  return (
    <Dialog isOpen={isOpen} onClose={saving ? () => {} : onClose} title={t('students.fee.title')} size="md" footer={footer}>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            <CheckCircle2 size={22} />
            <div>
              <p className="font-semibold">{t('students.fee.received')}</p>
              <p className="text-sm tabular-nums">{formatMoney(t, result.amount)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-secondary-200 px-3 py-2.5 text-sm">
            <span className="text-secondary-600">{t('students.fee.dueAfter')}</span>
            <span className={`font-semibold tabular-nums ${dueAfter > 0 ? 'text-rose-600' : 'text-secondary-600'}`}>{formatMoney(t, dueAfter)}</span>
          </div>
          {dueAfter > Math.max(due - result.amount, 0) + 0.005 ? (
            <Notice tone="warn" title={t('students.fee.oldestFirst')} />
          ) : null}

          <div className="hidden">
            <div ref={receiptRef} className="mx-auto max-w-xs space-y-2 p-4 text-sm text-black">
              <p className="text-center text-base font-bold">{settings?.companyName || ''}</p>
              <p className="text-center font-semibold">{t('students.fee.receiptTitle')}</p>
              <hr />
              <p>{t('students.fee.date')}: {displayDate(result?.payment?.txDate || form.txDate)}</p>
              <p>{t('students.fee.receivedFrom')}: {studentName || enrollment?.student?.name || ''}</p>
              <p>{t('students.enrollment.course')}: {enrollment?.course?.name || ''}</p>
              <p>{t('students.fee.method')}: {t(`payments.${method === 'bank' ? 'bank' : 'cash'}`)}</p>
              <p className="text-base font-bold">{t('students.fee.amount')}: {formatMoney(t, result.amount)}</p>
              <p>{t('students.fee.dueAfter')}: {formatMoney(t, dueAfter)}</p>
              {form.note.trim() ? <p>{form.note.trim()}</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <form id="collect-fee-form" className="space-y-4" onSubmit={submit}>
          <div className="rounded-xl bg-secondary-50 px-3 py-2.5 text-sm dark:bg-slate-800/60">
            <p className="font-semibold text-ink">{studentName || enrollment?.student?.name} · {enrollment?.course?.name}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-secondary-600">{t('students.fee.dueNow')}</span>
              <span className="font-semibold tabular-nums text-rose-600">{formatMoney(t, due)}</span>
            </div>
          </div>
          {due <= 0 ? <Notice tone="info" title={t('students.fee.nothingDue')} /> : null}
          {error ? <Notice tone="error" title={error} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fee-amount">{t('students.fee.amount')}</label>
              <input
                id="fee-amount"
                type="number"
                min="0"
                max={due || undefined}
                step="any"
                inputMode="decimal"
                className="input"
                value={form.amount}
                onChange={(event) => update({ amount: event.target.value })}
                autoFocus
              />
              <button
                type="button"
                className="mt-2 rounded-full border border-secondary-200 px-3 py-1.5 text-xs font-semibold text-ink-light hover:bg-mist"
                onClick={() => update({ amount: String(due) })}
                disabled={due <= 0}
              >
                {t('payments.fullAmount')}
              </button>
            </div>
            <div>
              <label className="label" htmlFor="fee-date">{t('students.fee.date')}</label>
              <input
                id="fee-date"
                type="date"
                className="input"
                value={form.txDate}
                onChange={(event) => update({ txDate: event.target.value })}
              />
            </div>
          </div>
          <PaymentMethodFields
            value={{ paymentMethod: form.paymentMethod, bankId: form.bankId }}
            onChange={(next) => update({ paymentMethod: next.paymentMethod, bankId: next.bankId || '' })}
          />
          <div>
            <label className="label" htmlFor="fee-note">{t('students.fee.note')}</label>
            <input
              id="fee-note"
              className="input"
              maxLength={500}
              value={form.note}
              onChange={(event) => update({ note: event.target.value })}
            />
          </div>
          <p className="text-xs text-secondary-500">{t('students.fee.oldestFirst')}</p>
        </form>
      )}
    </Dialog>
  );
}
