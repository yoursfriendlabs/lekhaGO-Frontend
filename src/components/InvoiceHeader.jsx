import { API_BASE } from '../lib/api';

/**
 * Professional invoice header used on all invoice types.
 *
 * Props:
 *   biz         — business settings object { companyName, address, phone, email, panVat, logoUrl }
 *   invoiceType — e.g. "Sales Invoice", "Purchase Invoice", "Service Invoice"
 *   invoiceNo   — string
 *   date        — display-ready date string
 *   status      — raw status string
 *   statusColor — tailwind bg+text classes for the badge
 */
export default function InvoiceHeader({ biz = {}, invoiceType, invoiceNo, date, status, statusColor }) {
  const logoSrc = biz.logoUrl
    ? biz.logoUrl.startsWith('http')
      ? biz.logoUrl
      : `${API_BASE}${biz.logoUrl}`
    : null;

  const hasDetails = biz.address || biz.phone || biz.email || biz.panVat;

  return (
    <div className="overflow-hidden rounded-t-2xl">
      {/* Accent bar */}
      <div className="h-1.5 w-full bg-primary" />

      <div className="flex items-start justify-between gap-6 px-0 pt-6 pb-6 border-b border-slate-200/70 dark:border-slate-800/70">
        {/* ── Left: business identity ── */}
        <div className="flex items-start gap-4 min-w-0">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Logo"
              className="h-16 w-16 shrink-0 rounded-xl border border-slate-200/70 bg-white object-contain p-1 shadow-sm"
            />
          ) : null}

          <div className="min-w-0">
            <h1 className={`font-serif font-bold text-slate-900 dark:text-white leading-tight ${logoSrc ? 'text-2xl' : 'text-3xl'}`}>
              {biz.companyName || 'ManageMyShop'}
            </h1>

            {hasDetails && (
              <div className="mt-1.5 space-y-0.5">
                {biz.address && (
                  <p className="whitespace-pre-wrap text-xs leading-snug text-slate-500 dark:text-slate-400">
                    {biz.address}
                  </p>
                )}
                {(biz.phone || biz.email) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[biz.phone, biz.email].filter(Boolean).join('  ·  ')}
                  </p>
                )}
                {biz.panVat && (
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    PAN / VAT No: {biz.panVat}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: invoice meta ── */}
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">
            {invoiceType}
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white">
            #{invoiceNo}
          </p>
          {date && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{date}</p>
          )}
          {status && (
            <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${statusColor || 'bg-slate-100 text-slate-600'}`}>
              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
