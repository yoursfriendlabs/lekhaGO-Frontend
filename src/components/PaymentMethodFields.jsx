import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import NoteTextarea from './NoteTextarea.jsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { getEffectivePaymentMethod } from '../lib/payments';

function uniqById(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;

    seen.add(item.id);
    return true;
  });
}

export default function PaymentMethodFields({
  value = {},
  onChange,
  showPaymentNote = true,
  noteLabel,
  notePlaceholder,
  className = '',
}) {
  const { t } = useI18n();

  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankError, setBankError] = useState('');

  const paymentMethod = getEffectivePaymentMethod(
    value.paymentMethod,
    value.bankId
  );

  const bankId = String(value.bankId || '').trim();

  const formatMoney = (amount) =>
    t('currency.formatted', {
      symbol: t('currency.symbol'),
      amount: Number(amount || 0).toFixed(2),
    });

  const updateValue = (patch) => {
    onChange({
      paymentMethod,
      bankId,
      paymentNote: value.paymentNote || '',
      ...patch,
    });
  };

  useEffect(() => {
    let isMounted = true;

    const loadBanks = async () => {
      try {
        setLoadingBanks(true);
        setBankError('');

        const response = await api.listBanks({
          isActive: true,
          limit: 100,
          offset: 0,
        });

        if (!isMounted) return;

        setBanks(uniqById(response?.items));
      } catch (error) {
        if (!isMounted) return;

        setBanks([]);
        setBankError(error.message || t('common.error'));
      } finally {
        if (isMounted) {
          setLoadingBanks(false);
        }
      }
    };

    loadBanks();

    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!bankId || banks.some((bank) => bank.id === bankId)) return;

    let isMounted = true;

    const loadSelectedBank = async () => {
      try {
        const bank = await api.getBank(bankId);

        if (!isMounted || !bank?.id) return;

        setBanks((previous) => uniqById([...previous, bank]));
      } catch {
        //
      }
    };

    loadSelectedBank();

    return () => {
      isMounted = false;
    };
  }, [bankId, banks]);

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        value: bank.id,
        label: [
          bank.name || t('banks.unnamed'),
          bank.accountNumber || bank.accountName,
          formatMoney(bank.currentBalance),
        ]
          .filter(Boolean)
          .join(' • '),
      })),
    [banks, t]
  );

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === bankId) || null,
    [banks, bankId]
  );

  const fieldClassName =
    'h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100';

  const noteFieldClassName =
    'min-h-[88px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100';

  const labelClassName =
    'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400';

  const helperClassName = 'text-[11px] leading-5';

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <div className="min-w-0">
        <label className={labelClassName}>
          {t('payments.paymentMethod')}
        </label>

        <select
          className={fieldClassName}
          value={paymentMethod}
          onChange={(event) => {
            const nextMethod = event.target.value;

            updateValue({
              paymentMethod: nextMethod,
              bankId: nextMethod === 'bank' ? bankId : '',
            });
          }}
        >
          <option value="cash">{t('payments.cash')}</option>
          <option value="bank">{t('payments.bank')}</option>
        </select>
      </div>

      {paymentMethod === 'bank' && (
        <div className="min-w-0">
          <label className={labelClassName}>
            {t('payments.bankAccount')}
          </label>

          <SearchableSelect
            options={bankOptions}
            value={bankId}
            onChange={(nextBankId) =>
              updateValue({
                bankId: nextBankId,
                paymentMethod: nextBankId ? 'bank' : paymentMethod,
              })
            }
            placeholder={
              loadingBanks
                ? t('common.loading')
                : t('payments.selectBank')
            }
          />

          <div className="mt-1.5 space-y-1">
            {selectedBank && (
              <p className={`${helperClassName} text-slate-500`}>
                {t('payments.bankBalanceHint', {
                  amount: formatMoney(selectedBank.currentBalance),
                })}
              </p>
            )}

            {!loadingBanks &&
              !selectedBank &&
              bankOptions.length === 0 && (
                <p className={`${helperClassName} text-amber-600`}>
                  {t('payments.noBanks')}
                </p>
              )}

            {bankError && (
              <p className={`${helperClassName} text-rose-600`}>
                {bankError}
              </p>
            )}
          </div>
        </div>
      )}

      {showPaymentNote && (
        <div className="sm:col-span-2">
          <label className={labelClassName}>
            {noteLabel || t('payments.paymentNote')}
          </label>

          <NoteTextarea
            className={noteFieldClassName}
            value={value.paymentNote || ''}
            onChange={(event) =>
              updateValue({
                paymentNote: event.target.value,
              })
            }
            placeholder={
              notePlaceholder ||
              t('payments.paymentNotePlaceholder')
            }
          />
        </div>
      )}
    </div>
  );
}
