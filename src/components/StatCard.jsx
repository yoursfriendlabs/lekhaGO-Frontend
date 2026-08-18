export default function StatCard({ label, value, hint }) {
  return (
    <div className="card min-h-[140px]">
      <p className="text-xs uppercase tracking-[0.2em] text-secondary-500">{label}</p>
      <p className="mt-4 font-serif text-3xl text-ink">{value}</p>
      {hint ? <p className="mt-3 text-sm text-secondary-500">{hint}</p> : null}
    </div>
  );
}
