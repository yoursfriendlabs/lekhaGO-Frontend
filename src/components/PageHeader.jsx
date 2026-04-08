export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-col gap-4 md:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-serif text-2xl text-slate-900 dark:text-white sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 sm:text-base">{subtitle}</p> : null}
      </div>
      {action ? <div className="w-full min-w-0 sm:w-auto sm:max-w-full">{action}</div> : null}
    </div>
  );
}
