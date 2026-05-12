import { useI18n } from '../lib/i18n.jsx';

export default function Pagination({
  page,
  pageSize,
  total = null,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  hasNext = false,
  showPageSize = true,
}) {
  const { t } = useI18n();
  const hasTotal = Number.isFinite(total);
  const totalPages = hasTotal ? Math.max(Math.ceil(total / pageSize), 1) : null;
  const start = hasTotal && total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = hasTotal ? Math.min(page * pageSize, total) : page * pageSize;
  const nextDisabled = hasTotal ? page >= totalPages : !hasNext;

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600 dark:text-slate-300">
      <div className="text-center sm:text-left">
        {hasTotal ? t('pagination.showing', { start, end, total }) : `${t('pagination.page')} ${page}`}
      </div>
      {showPageSize && onPageSizeChange ? (
        <div className="flex items-center justify-center gap-2">
          <label className="text-xs uppercase text-slate-400">{t('pagination.rows')}</label>
          <select
            className="rounded-md w-20 min-h-[44px] px-2"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost min-h-[44px] min-w-[44px] px-3"
          type="button"
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page <= 1}
        >
          {t('pagination.previous')}
        </button>
        <span className="text-xs text-slate-500 min-w-[80px] text-center">
          {hasTotal ? `${t('pagination.page')} ${page} ${t('pagination.of')} ${totalPages}` : `${t('pagination.page')} ${page}`}
        </span>
        <button
          className="btn-ghost min-h-[44px] min-w-[44px] px-3"
          type="button"
          onClick={() => onPageChange(hasTotal ? Math.min(page + 1, totalPages) : page + 1)}
          disabled={nextDisabled}
        >
          {t('pagination.next')}
        </button>
      </div>
    </div>
  );
}
