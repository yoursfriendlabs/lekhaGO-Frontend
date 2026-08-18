import { useI18n } from '../lib/i18n.jsx';
import { getPaymentTypeDisplay, hasPaymentTypeData } from '../lib/paymentType';

export default function PaymentTypeSummary({
  source,
  className = '',
  labelClassName = '',
  metaClassName = '',
  align = 'left',
}) {
  const { t } = useI18n();

  const formatMoney = (amount) => t('currency.formatted', {
    symbol: t('currency.symbol'),
    amount: Number(amount || 0).toFixed(2),
  });

  if (!hasPaymentTypeData(source)) {
    return null;
  }

  const payment = getPaymentTypeDisplay(source, {
    cashLabel: t('payments.cash'),
    bankLabel: t('payments.bank'),
    balancePrefix: t('payments.balancePrefix'),
    formatMoney,
  });

  return (
    <div className={`min-w-0 ${className}`}>
      <p className={`truncate text-sm font-medium text-ink-light dark:text-secondary-300 ${align === 'right' ? 'text-right' : ''} ${labelClassName}`}>
        {payment.label}
      </p>
      {payment.balanceText ? (
        <p className={`truncate text-xs text-secondary-500 ${align === 'right' ? 'text-right' : ''} ${metaClassName}`}>
          {payment.balanceText}
        </p>
      ) : null}
    </div>
  );
}
