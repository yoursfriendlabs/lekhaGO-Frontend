import { useEffect, useState } from 'react';
import Notice from '../Notice';
import PaymentMethodFields from '../PaymentMethodFields';
import { Dialog } from '../ui/Dialog.tsx';
import { todayISODate } from '../../lib/datetime';
import { useI18n } from '../../lib/i18n.jsx';
import { requiresBankSelection } from '../../lib/payments';
import { STAFF_LEDGER_ENTRY_TYPES } from '../../lib/staff';

const EMPTY_FORM = {
  entryType: 'salary_payment',
  amount: '',
  entryDate: todayISODate(),
  referenceMonth: '',
  paymentMethod: 'cash',
  bankId: '',
  note: '',
};

function buildFormState(entry = {}) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};

  return {
    entryType: String(safeEntry.entryType || 'salary_payment').trim() || 'salary_payment',
    amount: safeEntry.amount === 0 || safeEntry.amount ? String(safeEntry.amount) : '',
    entryDate: String(safeEntry.entryDate || todayISODate()).slice(0, 10),
    referenceMonth: String(safeEntry.referenceMonth || '').slice(0, 7),
    paymentMethod: String(safeEntry.paymentMethod || (safeEntry.bankId ? 'bank' : 'cash')).trim() || 'cash',
    bankId: String(safeEntry.bankId || '').trim(),
    note: String(safeEntry.note || ''),
  };
}

export default function StaffLedgerEntryModal({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  saving = false,
  errorMessage = '',
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [localError, setLocalError] = useState('');
  const getEntryTypeLabel = (entryType) =>
    STAFF_LEDGER_ENTRY_TYPES.includes(entryType)
      ? t(`staffManagement.entryTypes.${entryType}`)
      : entryType;

  useEffect(() => {
    if (!isOpen) return;

    setForm(buildFormState(initialValues));
    setLocalError('');
  }, [initialValues, isOpen]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setLocalError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const amount = Number(form.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError(t('staffManagement.validation.ledgerAmountInvalid'));
      return;
    }

    if (!form.entryDate) {
      setLocalError(t('staffManagement.validation.ledgerDateRequired'));
      return;
    }

    if (requiresBankSelection({ paymentMethod: form.paymentMethod, bankId: form.bankId }, amount)) {
      setLocalError(t('payments.bankRequired'));
      return;
    }

    await onSubmit({
      entryType: form.entryType,
      amount,
      entryDate: form.entryDate,
      referenceMonth: form.referenceMonth || undefined,
      paymentMethod: form.paymentMethod,
      bankId: form.paymentMethod === 'bank' ? form.bankId || undefined : undefined,
      note: form.note.trim(),
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        initialValues?.id
          ? t('staffManagement.ledger.editEntry')
          : t('staffManagement.ledger.addEntry')
      }
      size="lg"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {localError ? <Notice title={localError} tone="error" /> : null}
        {errorMessage ? <Notice title={errorMessage} tone="error" /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="ledger-entry-type">
              {t('staffManagement.ledger.fields.entryType')}
            </label>
            <select
              id="ledger-entry-type"
              name="entryType"
              className="input mt-1"
              value={form.entryType}
              onChange={handleChange}
            >
              {STAFF_LEDGER_ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {getEntryTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ledger-amount">
              {t('staffManagement.ledger.fields.amount')}
            </label>
            <input
              id="ledger-amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              className="input mt-1"
              value={form.amount}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="ledger-entry-date">
              {t('staffManagement.ledger.fields.entryDate')}
            </label>
            <input
              id="ledger-entry-date"
              name="entryDate"
              type="date"
              className="input mt-1"
              value={form.entryDate}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="ledger-reference-month">
              {t('staffManagement.ledger.fields.referenceMonth')}
            </label>
            <input
              id="ledger-reference-month"
              name="referenceMonth"
              type="month"
              className="input mt-1"
              value={form.referenceMonth}
              onChange={handleChange}
            />
          </div>
        </div>

        <PaymentMethodFields
          value={{
            paymentMethod: form.paymentMethod,
            bankId: form.bankId,
            paymentNote: form.note,
          }}
          onChange={(payment) => {
            setForm((previous) => ({
              ...previous,
              paymentMethod: payment.paymentMethod,
              bankId: payment.bankId,
              note: payment.paymentNote,
            }));
            setLocalError('');
          }}
          noteLabel={t('staffManagement.ledger.fields.note')}
          notePlaceholder={t('staffManagement.ledger.notePlaceholder')}
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? t('staffManagement.ledger.savingEntry')
              : initialValues?.id
                ? t('common.update')
                : t('common.create')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
