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
 *   reprintLabel — optional IRD reprint banner, e.g. "Copy of Original – 1"
 */
export default function InvoiceHeader({ biz = {}, invoiceType, invoiceNo, date, status, statusColor, reprintLabel }) {
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

      <div className="flex items-start justify-between gap-6 px-0 pt-6 pb-6 border-b border-secondary-200/70">
        {/* ── Left: business identity ── */}
        <div className="flex items-start gap-4 min-w-0">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Logo"
              className="h-16 w-16 shrink-0 rounded-xl border border-secondary-200/70 bg-white object-contain p-1 shadow-sm"
            />
          ) : null}

          <div className="min-w-0">
            <h1 className={`font-serif font-bold text-ink leading-tight ${logoSrc ? 'text-2xl' : 'text-3xl'}`}>
              {biz.companyName || 'PasalManager'}
            </h1>

            {hasDetails && (
              <div className="mt-1.5 space-y-0.5">
                {biz.address && (
                  <p className="whitespace-pre-wrap text-xs leading-snug text-secondary-500">
                    {biz.address}
                  </p>
                )}
                {(biz.phone || biz.email) && (
                  <p className="text-xs text-secondary-500">
                    {[biz.phone, biz.email].filter(Boolean).join('  ·  ')}
                  </p>
                )}
                {biz.panVat && (
                  <p className="text-xs font-semibold text-secondary-700">
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
          {reprintLabel ? (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
              {reprintLabel}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-xl font-bold text-ink">
            #{invoiceNo}
          </p>
          {date && (
            <p className="mt-1 text-xs text-secondary-500">{date}</p>
          )}
          {status && (
            <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${statusColor || 'bg-secondary-100 text-secondary-700'}`}>
              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
