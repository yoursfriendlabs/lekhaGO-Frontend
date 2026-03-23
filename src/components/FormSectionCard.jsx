export default function FormSectionCard({ title, hint, action, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/70 bg-white/85 p-4 shadow-sm shadow-slate-200/30 dark:border-slate-800/60 dark:bg-slate-950/40 dark:shadow-none ${className}`}
    >
      {(title || hint || action) ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title ? <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3> : null}
            {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
          </div>
          {action ? <div className="w-full sm:w-auto">{action}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
