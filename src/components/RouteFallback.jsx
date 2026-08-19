export default function RouteFallback({ title = 'Loading workspace', description = 'Preparing the next screen and syncing cached data.' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-secondary-200/80 bg-white/90 p-6 text-center shadow-sm dark:border-slate-800/70 dark:bg-slate-900/80">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
        <h2 className="mt-4 font-serif text-2xl text-ink">{title}</h2>
        <p className="mt-2 text-sm text-secondary-500">{description}</p>
      </div>
    </div>
  );
}
