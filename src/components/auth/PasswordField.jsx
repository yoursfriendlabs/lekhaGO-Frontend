import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../../lib/i18n.jsx';

export default function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  disabled = false,
  required = false,
  hint = '',
  error = '',
  className = '',
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();

  return (
    <div className={className}>
      <label className="label" htmlFor={fieldId}>{label}</label>
      <div className="relative mt-1">
        <input
          id={fieldId}
          name={name}
          className={`input pr-12 ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200' : ''}`}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? <p id={`${fieldId}-error`} className="mt-1 text-xs text-rose-600">{error}</p> : null}
      {!error && hint ? <p id={`${fieldId}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
