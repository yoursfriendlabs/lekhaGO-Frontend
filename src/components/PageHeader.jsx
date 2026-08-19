export default function PageHeader({ id, title, subtitle, action }) {
  return (
    <div id={id || undefined} className="mb-5 flex flex-wrap items-center justify-between gap-4 md:mb-6">
      <div className="min-w-0">
        <h2 className="page-title">{title}</h2>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="min-w-0 sm:w-auto sm:max-w-full">{action}</div> : null}
    </div>
  );
}
