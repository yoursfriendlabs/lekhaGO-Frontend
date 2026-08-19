export const STATS_GRID_CLASS = 'grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4';

const TONE_STYLES = {
  danger: {
    text: 'text-rose-600 dark:text-rose-400',
    icon: 'bg-rose-50 text-rose-500 dark:bg-rose-950/30 dark:text-rose-300',
  },
  warning: {
    text: 'text-amber-600 dark:text-amber-400',
    icon: 'bg-amber-50 text-amber-500 dark:bg-amber-950/30 dark:text-amber-300',
  },
  success: {
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-300',
  },
  info: {
    text: 'text-sky-600 dark:text-sky-400',
    icon: 'bg-sky-50 text-sky-500 dark:bg-sky-950/30 dark:text-sky-300',
  },
  default: {
    text: 'text-ink',
    icon: 'bg-primary/10 text-primary',
  },
};

export default function StatsCard({
  title,
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  loading = false,
  onClick,
  isActive = false,
<<<<<<< HEAD
=======
  children,
  id,
>>>>>>> 8eae9c5815bd9dac96a1dad460647a583bfa9292
}) {
  const heading = title || label || '';
  const colors = TONE_STYLES[tone] || TONE_STYLES.default;
  const displayValue = loading ? '…' : value;
  const valueText = displayValue == null ? '' : String(displayValue);
  const isLongValue = valueText.length > 12;

  return (
    <div
<<<<<<< HEAD
      className={`card flex items-center justify-between border backdrop-blur-md transition ${
        isActive
          ? 'border-primary ring-1 ring-primary bg-primary-50/15 dark:bg-primary-950/15 shadow-md scale-[1.01]'
          : 'border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 shadow-sm'
      } ${paddingClasses[size] || paddingClasses.default} ${
        onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow' : ''
      }`}
=======
      id={id}
      className={`flex items-center justify-between gap-3 rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur-sm transition dark:bg-slate-900/70 ${
        isActive
          ? 'border-primary ring-1 ring-primary/40 bg-primary-50/20 shadow-md dark:bg-primary-950/20'
          : 'border-secondary-200/70 dark:border-slate-800/60'
      } ${onClick ? 'cursor-pointer hover:border-primary/40 hover:shadow' : ''}`}
>>>>>>> 8eae9c5815bd9dac96a1dad460647a583bfa9292
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(event);
        }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="min-w-0">
        {heading ? (
          <p className="truncate font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary-500">
            {heading}
          </p>
        ) : null}
        <p
          className={`mt-1.5 break-words font-serif font-semibold tabular-nums tracking-tight leading-tight ${
            colors.text
          } ${isLongValue ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'}`}
        >
          {displayValue}
        </p>
        {hint ? (
          <p className="mt-1 truncate text-xs leading-5 text-secondary-500">{hint}</p>
        ) : null}
        {children}
      </div>
      {Icon ? (
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
    </div>
  );
}
