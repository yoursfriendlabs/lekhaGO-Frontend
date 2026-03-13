export default function Notice({ title, description, tone = 'info' }) {
  const tones = {
    info: 'border-slate-200 bg-white text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300',
    success: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200',
    error: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200',
    warn: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone] || tones.info}`}>
      <p className="font-semibold">{title}</p>
      {description ? <p className="text-xs text-inherit/80">{description}</p> : null}
    </div>
  );
}
