import DateDisplay from '../../components/form/DateDisplay.jsx';

const STATEMENT_COL_SPAN = 6;

function paymentLabelOf(row) {
  const label = String(row?.paymentDisplay?.label || '').trim();
  return !label || label === '-' ? '' : label;
}

export function StatementParticulars({ row, showParty, hideType = false }) {
  const paymentLabel = paymentLabelOf(row);
  const meta = [hideType ? null : row.typeMeta?.label, paymentLabel].filter(Boolean).join(' · ');

  return (
    <div className="min-w-0 space-y-0.5">
      <p className="font-medium leading-snug text-ink">{row.referenceDisplay}</p>
      {showParty ? (
        <p className="text-[11px] leading-snug text-secondary-500">{row.partyDisplay}</p>
      ) : null}
      {meta ? <p className="text-[11px] leading-snug text-secondary-500">{meta}</p> : null}
    </div>
  );
}

function StatementMoney({ value, formatMoney, className = '' }) {
  const amount = Number(value || 0);
  return (
    <span className={`inline-block whitespace-nowrap tabular-nums ${className}`}>
      {amount > 0 ? formatMoney(amount) : '—'}
    </span>
  );
}

function StatementTableHead({ t, showSort, onToggleSort, SortIcon, compact = false }) {
  return (
    <thead className={`${compact ? 'text-[10px]' : 'text-xs'} uppercase tracking-wide text-ink`}>
      <tr className="border-b border-secondary-200">
        <th className="party-statement-col-date py-2 pr-2 text-left">
          {showSort ? (
            <button
              type="button"
              onClick={onToggleSort}
              className="inline-flex items-center gap-1 font-semibold hover:text-secondary-700 dark:hover:text-secondary-300"
            >
              {t('common.date')}
              {SortIcon}
            </button>
          ) : (
            t('common.date')
          )}
        </th>
        <th className="party-statement-col-details py-2 pr-2 text-left">{t('ledger.transaction')}</th>
        <th className="party-statement-col-note py-2 px-2 text-left">{t('ledger.note')}</th>
        <th className="party-statement-col-money py-2 pl-2 text-right">{t('ledger.debit')}</th>
        <th className="party-statement-col-money py-2 pl-2 text-right">{t('ledger.credit')}</th>
        <th className="party-statement-col-money py-2 pl-2 text-right">{t('ledger.balance')}</th>
      </tr>
    </thead>
  );
}

function StatementTableRow({ row, showParty, t, formatMoney, getBalanceToneClass, interactive = false }) {
  return (
    <tr className={`align-top ${interactive ? 'transition-colors hover:bg-mist/50 dark:hover:bg-slate-800/20' : ''}`}>
      <td className="party-statement-col-date whitespace-nowrap py-2 pr-2">
        <DateDisplay date={row.date} format="DD/MM/YYYY" />
      </td>
      <td className="party-statement-col-details py-2 pr-2">
        <StatementParticulars row={row} showParty={showParty} />
      </td>
      <td className="party-statement-col-note py-2 px-2 text-left text-secondary-600">
        {row.noteDisplay ? (
          <p className="whitespace-pre-wrap break-words leading-snug">{row.noteDisplay}</p>
        ) : null}
      </td>
      <td className="party-statement-col-money py-2 pl-2 text-right text-rose-700">
        <StatementMoney value={row.debit} formatMoney={formatMoney} />
      </td>
      <td className="party-statement-col-money py-2 pl-2 text-right text-emerald-700">
        <StatementMoney value={row.credit} formatMoney={formatMoney} />
      </td>
      <td className={`party-statement-col-money py-2 pl-2 text-right ${getBalanceToneClass(row.runningBalance)}`}>
        <span className="inline-block whitespace-nowrap tabular-nums">{formatMoney(row.runningBalance)}</span>
      </td>
    </tr>
  );
}

export function PartyStatementPrintSheet({
  t,
  logoSrc,
  biz,
  selectedPartyLabel,
  timeSpanLabel,
  balanceLabel,
  balanceToneClass,
  ledgerSummary,
  formatMoney,
  statementRows,
  showParty,
  getBalanceToneClass,
}) {
  return (
    <div className="hidden print:block">
      <div className="party-statement-sheet overflow-hidden rounded-2xl border border-secondary-200 bg-white">
        <div className="h-1.5 w-full bg-primary" />
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-secondary-200 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="Logo"
                className="h-12 w-12 shrink-0 rounded-lg border border-secondary-200 bg-white object-contain p-1"
              />
            ) : null}
            <div className="min-w-0">
              <h1 className={`font-serif font-bold leading-tight text-ink ${logoSrc ? 'text-xl' : 'text-2xl'}`}>
                {biz?.companyName || 'PasalManager'}
              </h1>
              {(biz?.address || biz?.phone || biz?.email || biz?.panVat) ? (
                <div className="mt-1 space-y-0.5">
                  {biz?.address ? <p className="whitespace-pre-wrap text-[11px] leading-snug text-secondary-500">{biz.address}</p> : null}
                  {(biz?.phone || biz?.email) ? <p className="text-[11px] text-secondary-500">{[biz.phone, biz.email].filter(Boolean).join('  ·  ')}</p> : null}
                  {biz?.panVat ? <p className="text-[11px] font-semibold text-secondary-700">PAN / VAT No: {biz.panVat}</p> : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="min-w-[10rem] text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-600">{t('ledger.statementTitle')}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{selectedPartyLabel}</p>
            <p className="mt-1 text-[11px] text-secondary-500">{timeSpanLabel}</p>
            <p className="mt-1.5 text-[11px] text-secondary-400" data-printed-at />
          </div>
        </div>
        <div className="border-b border-secondary-200 bg-mist px-4 py-3 sm:px-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-400">{balanceLabel}</p>
              <p className={`mt-1 whitespace-nowrap text-sm font-semibold tabular-nums ${balanceToneClass}`}>
                {formatMoney(Math.abs(ledgerSummary.currentBalance))}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-400">{t('ledger.totalDebit')}</p>
              <p className="mt-1 whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
                {formatMoney(ledgerSummary.totalDebit)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-400">{t('ledger.totalCredit')}</p>
              <p className="mt-1 whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
                {formatMoney(ledgerSummary.totalCredit)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-400">{t('ledger.totalEntries')}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{ledgerSummary.entries}</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 sm:px-5">
          <table className="party-statement-table w-full text-[11px] text-ink-light">
            <StatementTableHead t={t} compact />
            <tbody className="divide-y divide-slate-100">
              {statementRows.length === 0 ? (
                <tr>
                  <td colSpan={STATEMENT_COL_SPAN} className="py-4 text-center text-secondary-400">{t('ledger.noTransactions')}</td>
                </tr>
              ) : (
                statementRows.map((row) => (
                  <StatementTableRow
                    key={`print-${row.type}-${row.id}`}
                    row={row}
                    showParty={showParty}
                    t={t}
                    formatMoney={formatMoney}
                    getBalanceToneClass={getBalanceToneClass}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-secondary-200 bg-mist px-4 py-3 sm:px-5">
          <p className="text-[11px] text-secondary-400">{t('ledger.totalEntries')}: {ledgerSummary.entries}</p>
          <p className="text-[11px] text-secondary-400">
            {t('ledger.printedOn')} <span data-printed-date />
          </p>
        </div>
      </div>
    </div>
  );
}

function StatementMobileCard({ row, showParty, t, formatMoney, getBalanceToneClass }) {
  return (
    <article className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          <DateDisplay date={row.date} format="DD/MM/YYYY" />
        </p>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.typeMeta.className}`}>
          {row.typeMeta.label}
        </span>
      </div>
      <StatementParticulars row={row} showParty={showParty} hideType />
      {row.noteDisplay ? (
        <p className="whitespace-pre-wrap break-words text-sm text-secondary-600">
          <span className="font-semibold text-secondary-400">{t('ledger.note')}: </span>
          {row.noteDisplay}
        </p>
      ) : null}
      <dl className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="min-w-0">
          <dt className="text-secondary-400">{t('ledger.debit')}</dt>
          <dd className="mt-0.5 font-semibold text-rose-700">
            <StatementMoney value={row.debit} formatMoney={formatMoney} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-secondary-400">{t('ledger.credit')}</dt>
          <dd className="mt-0.5 font-semibold text-emerald-700">
            <StatementMoney value={row.credit} formatMoney={formatMoney} />
          </dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-secondary-400">{t('ledger.balance')}</dt>
          <dd className={`mt-0.5 font-semibold ${getBalanceToneClass(row.runningBalance)}`}>
            <span className="inline-block whitespace-nowrap tabular-nums">{formatMoney(row.runningBalance)}</span>
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function PartyStatementEntries({
  t,
  statementRows,
  showParty,
  formatMoney,
  getBalanceToneClass,
  isBusy,
  onToggleSort,
  SortIcon,
}) {
  const empty = (
    <p className="py-6 text-center text-sm text-secondary-400">
      {isBusy ? t('common.loading') : t('ledger.noTransactions')}
    </p>
  );

  return (
    <>
      <div className="mb-1 flex justify-end md:hidden">
        <button
          type="button"
          onClick={onToggleSort}
          className="inline-flex min-h-[40px] items-center gap-1 text-xs font-semibold text-ink"
        >
          {t('common.date')}
          {SortIcon}
        </button>
      </div>
      <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
        {statementRows.length === 0
          ? empty
          : statementRows.map((row) => (
            <StatementMobileCard
              key={`${row.type}-${row.id}`}
              row={row}
              showParty={showParty}
              t={t}
              formatMoney={formatMoney}
              getBalanceToneClass={getBalanceToneClass}
            />
          ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="party-statement-table w-full min-w-[42rem] text-sm">
          <StatementTableHead
            t={t}
            showSort
            onToggleSort={onToggleSort}
            SortIcon={SortIcon}
          />
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {statementRows.length === 0 ? (
              <tr>
                <td colSpan={STATEMENT_COL_SPAN} className="py-4 text-center text-secondary-400">
                  {isBusy ? t('common.loading') : t('ledger.noTransactions')}
                </td>
              </tr>
            ) : (
              statementRows.map((row) => (
                <StatementTableRow
                  key={`${row.type}-${row.id}`}
                  row={row}
                  showParty={showParty}
                  t={t}
                  formatMoney={formatMoney}
                  getBalanceToneClass={getBalanceToneClass}
                  interactive
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
