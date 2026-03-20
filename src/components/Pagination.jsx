import { useI18n } from '../lib/i18n.jsx';

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}) {
  const { t } = useI18n();
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
      <div>
        {t('pagination.showing', { start, end, total })}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs uppercase text-slate-400">{t('pagination.rows')}</label>
        <select
          className="rounded-md w-18  "
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost"
          type="button"
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page <= 1}
        >
          {t('pagination.previous')}
        </button>
        <span className="text-xs text-slate-500">
          {t('pagination.page')} {page} {t('pagination.of')} {totalPages}
        </span>
        <button
          className="btn-ghost"
          type="button"
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          disabled={page >= totalPages}
        >
          {t('pagination.next')}
        </button>
      </div>
    </div>
  );
}
