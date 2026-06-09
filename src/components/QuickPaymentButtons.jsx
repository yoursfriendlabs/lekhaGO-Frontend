import { useI18n } from '../lib/i18n.jsx';

export default function QuickPaymentButtons({
  disabled = false,
  onNoPayment,
  onHalfPayment,
  onFullPayment,
  className = '',
}) {
  const { t } = useI18n();

  const actions = [
    { label: t('payments.noPayment'), onClick: onNoPayment },
    { label: t('payments.fullAmount'), onClick: onFullPayment },
  ];

  return (
    <div className={`mt-2 flex flex-wrap gap-2 ${className}`}>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={disabled}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
