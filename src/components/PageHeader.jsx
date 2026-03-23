export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-serif text-3xl text-slate-900 dark:text-white">{title}</h2>
        {subtitle ? <p className="text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto">{action}</div> : null}
    </div>
  );
}
