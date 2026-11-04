import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';

/**
 * Adds a unit without leaving the product form, the same way a new category
 * can be typed in. The new unit is handed back so the form can select it.
 */
export default function UnitQuickCreate({ idPrefix = 'unit-quick', onCreated, disabled = false }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const close = () => {
    setOpen(false);
    setName('');
    setSymbol('');
    setMessage('');
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage(t('unitsManagement.validation.nameRequired'));
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const created = await api.createUnit({ name: trimmedName, symbol: symbol.trim() });
      onCreated?.(created);
      close();
    } catch (error) {
      setMessage(error?.status === 409 ? t('unitsManagement.messages.exists') : error?.message);
    } finally {
      setSaving(false);
    }
  };

  // The product form is a <form>; Enter here should add the unit, not save the product.
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCreate();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        id={`${idPrefix}-open`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 disabled:opacity-50 dark:text-primary-400"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Plus size={12} />
        {t('unitsManagement.addUnit')}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-secondary-200/80 p-2 dark:border-slate-700/60">
      <div className="flex gap-2">
        <input
          id={`${idPrefix}-name`}
          className="input-compact w-full min-w-0"
          placeholder={t('unitsManagement.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <input
          id={`${idPrefix}-symbol`}
          className="input-compact w-24 shrink-0"
          placeholder={t('unitsManagement.symbolPlaceholder')}
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          id={`${idPrefix}-save`}
          className="btn-primary min-h-[32px] px-3 text-xs"
          onClick={handleCreate}
          disabled={saving}
        >
          {saving ? t('common.loading') : t('unitsManagement.addUnit')}
        </button>
        <button
          type="button"
          className="btn-ghost min-h-[32px] gap-1 px-2 text-xs"
          onClick={close}
          disabled={saving}
        >
          <X size={12} />
          {t('common.cancel')}
        </button>
      </div>
      {message ? <p className="text-xs text-rose-600">{message}</p> : null}
    </div>
  );
}
