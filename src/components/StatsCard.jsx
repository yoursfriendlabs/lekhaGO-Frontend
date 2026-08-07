export default function StatsCard({ title, value, icon: Icon, tone = 'default', loading = false, size = 'default' }) {
  const toneColors = {
    danger: {
      text: 'text-rose-600 dark:text-rose-455 font-semibold',
      bg: 'bg-rose-50 dark:bg-rose-950/30 text-rose-500',
    },
    warning: {
      text: 'text-amber-600 dark:text-amber-455 font-semibold',
      bg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-500',
    },
    success: {
      text: 'text-emerald-600 dark:text-emerald-455 font-semibold',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500',
    },
    info: {
      text: 'text-blue-600 dark:text-blue-455 font-semibold',
      bg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-500',
    },
    default: {
      text: 'text-slate-900 dark:text-white',
      bg: 'bg-slate-50 dark:bg-slate-800/30 text-slate-500',
    },
  };

  const colors = toneColors[tone] || toneColors.default;

  const fontSizes = {
    sm: 'text-base md:text-lg',
    md: 'text-lg md:text-xl',
    lg: 'text-2xl md:text-3xl',
    default: 'text-2xl md:text-3xl',
  };

  const paddingClasses = {
    sm: 'p-3.5 rounded-xl',
    md: 'p-4 rounded-xl',
    default: 'p-5 rounded-2xl',
  };

  // Auto-downsize font size for long numeric or text values (e.g. large money amounts) to prevent grid breakage/wrapping
  const isLongValue = typeof value === 'string' || typeof value === 'number'
    ? value.toString().length > 10
    : false;

  let fontSizeClass = fontSizes[size] || fontSizes.default;
  if (isLongValue && size === 'default') {
    fontSizeClass = fontSizes.md; // scale down text-3xl to text-xl if long
  } else if (isLongValue && size === 'md') {
    fontSizeClass = fontSizes.sm; // scale down text-xl to text-lg if long
  }

  return (
    <div className={`card flex items-center justify-between border border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md shadow-sm ${paddingClasses[size] || paddingClasses.default}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
          {title}
        </p>
        <p className={`mt-2 font-serif font-bold ${colors.text} ${fontSizeClass} truncate`}>
          {loading ? '...' : value}
        </p>
      </div>
      {Icon && (
        <div className={`flex items-center justify-center shrink-0 ml-3 ${size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl'} ${colors.bg}`}>
          <Icon className={size === 'sm' ? 'h-4.5 w-4.5' : 'h-6 w-6'} />
        </div>
      )}
    </div>
  );
}
