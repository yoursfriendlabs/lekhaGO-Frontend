import { Delete, Divide, Minus, Percent, Plus, X } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';

const KEY_LAYOUT = [
  ['AC', '%', '÷', '⌫'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

function normalizeExpression(value = '') {
  return String(value || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '');
}

export function evaluateQuickExpression(value = '') {
  const expression = normalizeExpression(value);
  if (!expression) return 0;
  if (!/^[0-9+\-*/%.()]+$/.test(expression)) return 0;

  try {
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

function getKeyContent(key) {
  if (key === '⌫') return <Delete size={18} />;
  if (key === '×') return <X size={18} />;
  if (key === '÷') return <Divide size={18} />;
  if (key === '+') return <Plus size={18} />;
  if (key === '-') return <Minus size={18} />;
  if (key === '%') return <Percent size={18} />;
  return key;
}

function appendValue(current, next) {
  const value = String(current || '');

  if (next === '.') {
    const parts = value.split(/[+\-*/%×÷]/);
    const lastPart = parts[parts.length - 1] || '';
    if (lastPart.includes('.')) return value;
  }

  if (/^[+\-*/%×÷]$/.test(next)) {
    if (!value) return next === '-' ? '-' : '';
    if (/[+\-*/%×÷]$/.test(value)) {
      return `${value.slice(0, -1)}${next}`;
    }
  }

  return `${value}${next}`;
}

export default function QuickAmountPad({
  expression,
  onExpressionChange,
  onConfirm,
  submitLabel,
  helperText = '',
}) {
  const { t } = useI18n();
  const resolvedAmount = evaluateQuickExpression(expression);

  const handleKeyPress = (key) => {
    if (key === 'AC') {
      onExpressionChange('');
      return;
    }

    if (key === '⌫') {
      onExpressionChange(String(expression || '').slice(0, -1));
      return;
    }

    if (key === '=') {
      const nextValue = resolvedAmount > 0 ? resolvedAmount.toFixed(2) : '0';
      onExpressionChange(nextValue === '0.00' ? '0' : nextValue);
      return;
    }

    onExpressionChange(appendValue(expression, key));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[32px] border border-secondary-200/80 bg-white px-5 py-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {t('quickEntry.amount')}
            </p>
            {helperText ? <p className="mt-1 text-sm text-slate-500">{helperText}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">{t('quickEntry.liveTotal')}</p>
            <p className="text-xl font-semibold text-primary-700">
              {t('currency.formatted', {
                symbol: t('currency.symbol'),
                amount: resolvedAmount.toFixed(2),
              })}
            </p>
          </div>
        </div>

        <input
          className="mt-6 w-full border-0 bg-transparent p-0 text-right text-[2.6rem] font-semibold tracking-tight text-slate-900 focus:outline-none focus:ring-0"
          value={expression}
          onChange={(event) => onExpressionChange(event.target.value)}
          inputMode="decimal"
          placeholder="0"
          aria-label={t('quickEntry.amount')}
        />
      </div>

      {submitLabel ? (
        <button
          type="button"
          className="btn-primary h-14 w-full rounded-[24px] text-lg"
          onClick={onConfirm}
        >
          {submitLabel}
        </button>
      ) : null}

      <div className="grid grid-cols-4 gap-3">
        {KEY_LAYOUT.flat().map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKeyPress(key)}
            className={`flex h-14 items-center justify-center rounded-[22px] border text-lg font-semibold transition active:scale-[0.98] ${
              key === '='
                ? 'col-span-2 border-primary-500 bg-primary text-white shadow-sm hover:bg-primary-600'
                : /^[+\-×÷%⌫]$/.test(key)
                  ? 'border-secondary-200 bg-secondary-50 text-slate-700 hover:bg-secondary-100'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-primary-200 hover:bg-primary-50/40'
            }`}
          >
            {getKeyContent(key)}
          </button>
        ))}
      </div>
    </div>
  );
}
