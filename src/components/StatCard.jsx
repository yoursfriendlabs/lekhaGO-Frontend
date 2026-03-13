export default function StatCard({ label, value, hint }) {
  return (
    <div className="card min-h-[140px]">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-4 font-serif text-3xl text-slate-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}
