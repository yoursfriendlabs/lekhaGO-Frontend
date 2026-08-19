export default function FormSectionCard({ title, hint, action, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-secondary-200/70 bg-surface/85 p-4 shadow-sm shadow-primary/10 ${className}`}
    >
      {(title || hint || action) ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title ? <h3 className="text-sm font-semibold text-ink">{title}</h3> : null}
            {hint ? <p className="text-xs text-secondary-500">{hint}</p> : null}
          </div>
          {action ? <div className="w-full sm:w-auto">{action}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
