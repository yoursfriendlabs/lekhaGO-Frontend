import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { getEffectivePaymentMethod } from '../lib/payments';

function uniqById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export default function PaymentMethodFields({
  value,
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

  const paymentMethod = getEffectivePaymentMethod(value?.paymentMethod, value?.bankId);
  const bankId = String(value?.bankId || '').trim();

  const formatMoney = (amount) =>
    t('currency.formatted', {
      symbol: t('currency.symbol'),
      amount: Number(amount || 0).toFixed(2),
    });

  useEffect(() => {
    let isActive = true;

    setLoadingBanks(true);
    setBankError('');

    api.listBanks({ isActive: true, limit: 100, offset: 0 })
      .then((response) => {
        if (!isActive) return;
        setBanks(uniqById(response?.items || []));
      })
      .catch((error) => {
        if (!isActive) return;
        setBanks([]);
        setBankError(error.message);
      })
      .finally(() => {
        if (!isActive) return;
        setLoadingBanks(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!bankId || banks.some((bank) => bank.id === bankId)) return;

    let isActive = true;

    api.getBank(bankId)
      .then((bank) => {
        if (!isActive || !bank?.id) return;
        setBanks((previous) => uniqById([...previous, bank]));
      })
      .catch(() => null);

    return () => {
      isActive = false;
    };
  }, [bankId, banks]);

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        value: bank.id,
        label: [
          bank.name || t('banks.unnamed'),
          bank.accountNumber || bank.accountName || '',
          formatMoney(bank.currentBalance),
        ]
          .filter(Boolean)
          .join(' | '),
      })),
    [banks, t]
  );

  const selectedBank = banks.find((bank) => bank.id === bankId) || null;

  const updateValue = (patch) => {
    onChange({
      paymentMethod,
      bankId,
      paymentNote: value?.paymentNote || '',
      ...patch,
    });
  };

  return (
    <div className={`grid gap-3 md:grid-cols-3 ${className}`}>
      <div>
        <label className="label">{t('payments.paymentMethod')}</label>
        <select
          className="input mt-1"
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

      {paymentMethod === 'bank' ? (
        <div className={showPaymentNote ? 'md:col-span-2' : 'md:col-span-2'}>
          <label className="label">{t('payments.bankAccount')}</label>
          <div className="mt-1">
            <SearchableSelect
              options={bankOptions}
              value={bankId}
              onChange={(nextBankId) => updateValue({ bankId: nextBankId, paymentMethod: nextBankId ? 'bank' : paymentMethod })}
              placeholder={loadingBanks ? t('common.loading') : t('payments.selectBank')}
            />
          </div>
          {selectedBank ? (
            <p className="mt-1 text-xs text-slate-500">
              {t('payments.bankBalanceHint', { amount: formatMoney(selectedBank.currentBalance) })}
            </p>
          ) : null}
          {!loadingBanks && !selectedBank && bankOptions.length === 0 ? (
            <p className="mt-1 text-xs text-amber-600">{t('payments.noBanks')}</p>
          ) : null}
          {bankError ? <p className="mt-1 text-xs text-rose-600">{bankError}</p> : null}
        </div>
      ) : null}

      {showPaymentNote ? (
        <div className={paymentMethod === 'bank' ? 'md:col-span-3' : 'md:col-span-2'}>
          <label className="label">{noteLabel || t('payments.paymentNote')}</label>
          <input
            className="input mt-1"
            value={value?.paymentNote || ''}
            onChange={(event) => updateValue({ paymentNote: event.target.value })}
            placeholder={notePlaceholder || t('payments.paymentNotePlaceholder')}
          />
        </div>
      ) : null}
    </div>
  );
}
