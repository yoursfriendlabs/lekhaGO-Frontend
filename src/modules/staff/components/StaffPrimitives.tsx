import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FolderOpen, RefreshCcw, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function SectionCard({ title, subtitle, action, children, className }: SectionCardProps) {
  return (
    <section className={cn('card space-y-4', className)}>
      {(title || subtitle || action) ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {title ? <h3 className="font-serif text-xl text-slate-900 dark:text-white">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

interface SummaryCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}

export function SummaryMetricCard({ label, value, hint, icon }: SummaryCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm shadow-slate-200/40 dark:border-slate-800/70 dark:bg-slate-950/70 dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <div className="mt-3 font-serif text-3xl text-slate-900 dark:text-white">{value}</div>
        </div>
        {icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

interface StatusChipProps {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

export function StatusChip({ label, tone = 'neutral' }: StatusChipProps) {
  const toneClasses = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  };

  return (
    <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', toneClasses[tone])}>
      {label}
    </span>
  );
}

interface ErrorBannerProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorBanner({ title, description, onRetry }: ErrorBannerProps) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50/90 p-4 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-rose-100 p-2 text-rose-600 dark:bg-rose-400/10 dark:text-rose-200">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            {description ? <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-100/80">{description}</p> : null}
          </div>
        </div>
        {onRetry ? (
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={onRetry}>
            <RefreshCcw size={16} className="mr-2" />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300/80 bg-slate-50/90 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950/50">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <FolderOpen size={24} />
      </div>
      <h3 className="mt-4 font-serif text-xl text-slate-900 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle: string;
  emptyDescription: string;
  action?: ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  skeletonRows = 5,
  emptyTitle,
  emptyDescription,
  action,
}: DataTableProps<T>) {
  if (!loading && rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={action} />;
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200/70 dark:border-slate-800/70">
      <table className="min-w-full divide-y divide-slate-200/70 text-sm dark:divide-slate-800/70">
        <thead className="bg-slate-50/90 text-left text-xs uppercase tracking-[0.18em] text-slate-400 dark:bg-slate-900/70">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn('px-4 py-3 font-semibold', column.headerClassName)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/70 bg-white/90 text-slate-700 dark:divide-slate-800/70 dark:bg-slate-950/50 dark:text-slate-200">
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, index) => (
              <tr key={`skeleton-${index}`}>
                <td className="px-4 py-4" colSpan={columns.length}>
                  <div className="h-11 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
                </td>
              </tr>
            ))
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="align-top">
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-4', column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface InlineTabsProps {
  items: Array<{ to: string; label: string }>;
}

export function InlineTabs({ items }: InlineTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/app/staff'}
          className={({ isActive }) =>
            cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              isActive
                ? 'bg-primary text-white shadow-soft'
                : 'bg-white/80 text-slate-600 hover:bg-secondary-100 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800/70',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

interface SourceBannerProps {
  source: 'live' | 'mock';
  message: string;
}

export function SourceBanner({ source, message }: SourceBannerProps) {
  if (source === 'live') return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p className="font-semibold">Mock data active</p>
      <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">{message}</p>
    </div>
  );
}

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function DetailDrawer({ isOpen, onClose, title, children }: DetailDrawerProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstFocusable = containerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-slate-950/40 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Close details"
        onClick={onClose}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200/70 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/70">
          <h2 id={titleId} className="font-serif text-xl text-slate-900 dark:text-white">{title}</h2>
          <button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
