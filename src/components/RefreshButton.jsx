import { RefreshCw } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';

export default function RefreshButton({ refreshing = false, onClick, className = '' }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className={`btn-ghost inline-flex items-center justify-center gap-2 ${className}`}
      onClick={onClick}
      disabled={refreshing}
      aria-busy={refreshing}
    >
      <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
      {refreshing ? t('common.loading') : t('common.updateTables')}
    </button>
  );
}
