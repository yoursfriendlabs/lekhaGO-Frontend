import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import PaymentMethodFields from '@/components/form/PaymentMethodFields.jsx';
import Notice from '@/components/ui/Notice';
import { Dialog } from '@/components/ui/Dialog.tsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { buildPaymentPayload, requiresBankSelection } from '@/lib/money/payments';
import {
  chargeAmount,
  chargeLabel,
  errorMessage,
  money,
  normalizeFolio,
  num,
  tx,
} from '@/lib/hotel/hotelUtils';

const emptyPayment = () => ({ amount: '', paymentMethod: 'cash', bankId: '', paymentNote: '' });

function cleanExtras(extras) {
  return extras
    .map((extra) => ({ description: String(extra.description || '').trim(), amount: num(extra.amount) }))
    .filter((extra) => extra.description && extra.amount > 0);
}

export default function CheckOutDialog({ stay, initialFolio, onClose, onDone }) {
  const { t } = useI18n();
  const L = (key, fallback, vars) => tx(t, key, fallback, vars);

  const [extras, setExtras] = useState([]);
  const [discount, setDiscount] = useState('');
  const [mode, setMode] = useState('single'); // single | mixed
  const [payments, setPayments] = useState([emptyPayment()]);
  const amountTouched = useRef(false);

  const [preview, setPreview] = useState(() => normalizeFolio(initialFolio));
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const previewInput = useMemo(
    () => JSON.stringify({ extras: cleanExtras(extras), discount: num(discount) }),
    [extras, discount],
  );
  const debouncedInput = useDebouncedValue(previewInput, 350);

  useEffect(() => {
    let active = true;
    setPreviewLoading(true);
    setPreviewError('');
    api
      .previewHotelCheckOut(stay.id, JSON.parse(debouncedInput))
      .then((payload) => {
        if (!active) return;
        setPreview(normalizeFolio(payload?.folio || payload?.preview || payload));
      })
      .catch((err) => {
        if (active) setPreviewError(errorMessage(err));
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [stay.id, debouncedInput]);

  const balanceDue = Math.max(preview.balanceDue, 0);

  /* Keep the single payment amount in sync with the balance until edited. */
  useEffect(() => {
    if (mode !== 'single' || amountTouched.current) return;
    setPayments((prev) => [{ ...prev[0], amount: balanceDue > 0 ? String(balanceDue) : '' }]);
  }, [balanceDue, mode]);

  const paidNow = payments.reduce((sum, row) => sum + Math.max(num(row.amount), 0), 0);
  const remaining = Math.max(balanceDue - paidNow, 0);
  const overpaid = paidNow > balanceDue + 0.005;

  const updatePayment = (index, changes) => {
    if (index === 0 && 'amount' in changes) amountTouched.current = true;
    setPayments((prev) => prev.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  };

  const switchMode = (next) => {
    setMode(next);
    if (next === 'single') {
      amountTouched.current = false;
      setPayments([emptyPayment()]);
    } else if (payments.length < 2) {
      setPayments((prev) => [...prev, emptyPayment()]);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const active = payments.filter((row) => num(row.amount) > 0);
    if (overpaid) {
      setError(L('hotel.checkout.overpaid', 'Payment is more than the balance due.'));
      return;
    }
    if (active.some((row) => requiresBankSelection(row, num(row.amount)))) {
      setError(L('hotel.booking.bankRequired', 'Select a bank account for bank payments.'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await api.checkOutHotelStay(stay.id, {
        extras: cleanExtras(extras),
        discount: num(discount),
        payments: active.map((row) => ({
          amount: num(row.amount),
          ...buildPaymentPayload(row),
        })),
      });
      await onDone?.(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={() => !submitting && onClose()}
      title={L('hotel.checkout.title', 'Check out')}
      size="full"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="hotel-checkout-form" className="btn-primary" disabled={submitting || previewLoading}>
            {submitting ? t('common.loading') : L('hotel.checkout.confirm', 'Complete check-out')}
          </button>
        </>
      )}
    >
      <form id="hotel-checkout-form" onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          {error ? <Notice tone="error" title={error} /> : null}
          {previewError ? <Notice tone="warn" title={previewError} /> : null}

          {/* Extras */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-secondary-400">
                {L('hotel.checkout.extras', 'Extra charges')}
              </h4>
              <button
                type="button"
                className="btn-ghost flex items-center gap-1 text-xs"
                onClick={() => setExtras((prev) => [...prev, { description: '', amount: '' }])}
              >
                <Plus size={14} />
                {L('hotel.checkout.addExtra', 'Add extra')}
              </button>
            </div>
            {extras.length === 0 ? (
              <p className="text-xs text-secondary-500">
                {L('hotel.checkout.noExtras', 'Late check-out, damages, laundry… (optional)')}
              </p>
            ) : (
              extras.map((extra, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    className="input h-10 flex-1"
                    placeholder={L('hotel.checkout.extraDescription', 'Description')}
                    value={extra.description}
                    onChange={(e) =>
                      setExtras((prev) => prev.map((x, i) => (i === index ? { ...x, description: e.target.value } : x)))
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input h-10 w-28"
                    placeholder="0"
                    value={extra.amount}
                    onChange={(e) =>
                      setExtras((prev) => prev.map((x, i) => (i === index ? { ...x, amount: e.target.value } : x)))
                    }
                  />
                  <button
                    type="button"
                    className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                    onClick={() => setExtras((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={t('common.delete')}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))
            )}
          </section>

          <section>
            <label className="label">{L('hotel.checkout.discount', 'Discount')}</label>
            <input
              type="number"
              min="0"
              step="any"
              className="input w-full sm:w-48"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </section>

          {/* Payment */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-secondary-400">
                {L('hotel.checkout.payment', 'Payment')}
              </h4>
              <div className="flex rounded-xl border border-secondary-200 bg-white p-0.5 text-xs font-semibold">
                {['single', 'mixed'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchMode(key)}
                    className={`rounded-lg px-3 py-1 transition ${
                      mode === key ? 'bg-primary text-white' : 'text-secondary-600 hover:bg-mist'
                    }`}
                  >
                    {key === 'single'
                      ? L('hotel.checkout.single', 'Single')
                      : L('hotel.checkout.mixed', 'Mixed (cash + bank)')}
                  </button>
                ))}
              </div>
            </div>

            {payments.map((row, index) => (
              <div key={index} className="space-y-3 rounded-2xl border border-secondary-200 bg-white p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="label">
                      {mode === 'mixed'
                        ? `${L('hotel.checkout.paymentN', 'Payment')} ${index + 1}`
                        : L('hotel.checkout.amountReceived', 'Amount received')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="input"
                      value={row.amount}
                      onChange={(e) => updatePayment(index, { amount: e.target.value })}
                    />
                  </div>
                  {mode === 'mixed' && payments.length > 2 ? (
                    <button
                      type="button"
                      className="mb-1 rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                      onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={t('common.delete')}
                    >
                      <X size={15} />
                    </button>
                  ) : null}
                </div>
                <PaymentMethodFields
                  value={row}
                  onChange={(changes) => updatePayment(index, changes)}
                  showPaymentNote={mode === 'single'}
                />
              </div>
            ))}

            {mode === 'mixed' ? (
              <button
                type="button"
                className="btn-ghost flex items-center gap-1 text-xs"
                onClick={() => setPayments((prev) => [...prev, emptyPayment()])}
              >
                <Plus size={14} />
                {L('hotel.checkout.addPayment', 'Add payment line')}
              </button>
            ) : null}
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-2xl border border-secondary-200 bg-mist/60 p-4 text-sm">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-secondary-400">
              {L('hotel.checkout.summary', 'Bill summary')} {previewLoading ? '…' : ''}
            </h4>
            {preview.charges.length > 0 ? (
              <div className="mb-3 max-h-48 space-y-1 overflow-y-auto border-b border-secondary-200 pb-3">
                {preview.charges.map((line, index) => (
                  <div key={line.id || index} className="flex justify-between gap-3 text-xs text-secondary-600">
                    <span className="truncate">{chargeLabel(line)}</span>
                    <span className="shrink-0 tabular-nums">{money(t, chargeAmount(line))}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <SummaryRow label={L('hotel.stay.subtotal', 'Subtotal')} value={money(t, preview.subTotal)} />
            {preview.discount > 0 ? (
              <SummaryRow label={L('hotel.checkout.discount', 'Discount')} value={`-${money(t, preview.discount)}`} tone="warn" />
            ) : null}
            {preview.serviceChargeTotal > 0 ? (
              <SummaryRow label={L('hotel.stay.serviceCharge', 'Service charge')} value={money(t, preview.serviceChargeTotal)} />
            ) : null}
            {preview.taxTotal > 0 ? (
              <SummaryRow label={L('hotel.stay.tax', 'Tax')} value={money(t, preview.taxTotal)} />
            ) : null}
            <SummaryRow label={L('hotel.stay.grandTotal', 'Grand total')} value={money(t, preview.grandTotal)} strong />
            <SummaryRow label={L('hotel.stay.paidSoFar', 'Paid so far (incl. advance)')} value={money(t, preview.paid)} />
            <SummaryRow label={L('hotel.stay.balanceDue', 'Balance due')} value={money(t, balanceDue)} strong tone="danger" />
          </div>

          <div className="rounded-2xl border border-secondary-200 bg-white p-4 text-sm">
            <SummaryRow label={L('hotel.checkout.payingNow', 'Paying now')} value={money(t, paidNow)} />
            <SummaryRow
              label={L('hotel.checkout.remaining', 'Left unpaid after check-out')}
              value={money(t, remaining)}
              strong
              tone={remaining > 0 ? 'danger' : 'success'}
            />
            {remaining > 0 ? (
              <p className="mt-2 text-xs text-secondary-500">
                {L('hotel.checkout.remainingHint', 'Any unpaid amount stays as a due on the guest account.')}
              </p>
            ) : null}
            {overpaid ? (
              <p className="mt-2 text-xs font-semibold text-rose-600">
                {L('hotel.checkout.overpaid', 'Payment is more than the balance due.')}
              </p>
            ) : null}
          </div>
        </aside>
      </form>
    </Dialog>
  );
}

function SummaryRow({ label, value, strong = false, tone = '' }) {
  const toneClass = {
    danger: 'text-rose-600',
    success: 'text-emerald-600',
    warn: 'text-amber-700',
  }[tone] || 'text-ink';
  return (
    <div className={`flex justify-between gap-3 py-1 ${strong ? 'font-bold' : 'text-secondary-600'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${strong ? toneClass : ''}`}>{value}</span>
    </div>
  );
}
