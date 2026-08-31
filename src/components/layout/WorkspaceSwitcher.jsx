import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Store } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n.jsx';
import { Dialog } from '../ui/Dialog.tsx';

const EXTRA_TYPES = [
  { value: 'retail', labelKey: 'workspace.types.standard' },
  { value: 'cafe', labelKey: 'workspace.types.cafe' },
];

export default function WorkspaceSwitcher() {
  const { t } = useI18n();
  const {
    businessId,
    business,
    businessProfile,
    businesses,
    canCreateBusiness,
    switchWorkspace,
    createWorkspace,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('retail');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => (Array.isArray(businesses) ? businesses : []), [businesses]);
  const current = items.find((item) => item.id === businessId || item.businessId === businessId);
  const title = current?.name || business?.name || businessProfile?.label || t('topbar.welcome');
  const subtitle = current?.label || businessProfile?.label || '';

  async function handleSwitch(id) {
    if (!id || id === businessId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await switchWorkspace(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspace.switchFailed'));
      setBusy(false);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t('workspace.nameRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createWorkspace({ name: name.trim(), type });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspace.createFailed'));
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="min-w-0 flex-1 rounded-xl text-left transition-colors hover:bg-secondary-50/80"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500">{t('topbar.workspace')}</p>
        <span className="flex min-w-0 items-center gap-1">
          <h2 className="truncate font-serif text-base text-ink sm:text-lg">{title}</h2>
          <ChevronDown className="h-4 w-4 shrink-0 text-secondary-400" />
        </span>
        {subtitle && subtitle !== title ? (
          <p className="mt-1 truncate text-xs font-medium text-secondary-500">{subtitle}</p>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-4 right-4 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-secondary-200 bg-surface shadow-xl md:left-6 md:right-auto md:w-80">
          <div className="max-h-80 overflow-y-auto p-2">
            {items.map((item) => {
              const id = item.id || item.businessId;
              const active = id === businessId;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleSwitch(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                    active ? 'bg-primary/10 text-primary-700' : 'text-ink hover:bg-secondary-50'
                  }`}
                >
                  <Store className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.name}</span>
                    <span className="block truncate text-xs text-secondary-500">
                      {item.label}
                      {item.isPersonal ? ` · ${t('workspace.personal')}` : ''}
                    </span>
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
          {canCreateBusiness ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              className="flex w-full items-center gap-2 border-t border-secondary-100 px-4 py-3 text-sm font-semibold text-primary-700 hover:bg-primary/5"
            >
              <Plus className="h-4 w-4" />
              {t('workspace.addBusiness')}
            </button>
          ) : null}
          {error && !creating ? <p className="px-4 pb-3 text-xs text-rose-600">{error}</p> : null}
        </div>
      ) : null}

      <Dialog
        isOpen={creating}
        onClose={() => !busy && setCreating(false)}
        title={t('workspace.addBusiness')}
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleCreate}>
          <p className="text-sm text-secondary-500">{t('workspace.addBusinessHint')}</p>
          <label className="block text-sm font-medium text-ink">
            {t('workspace.businessName')}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-secondary-200 bg-surface px-3 py-2.5"
              placeholder={t('workspace.businessNamePlaceholder')}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">{t('workspace.businessType')}</legend>
            {EXTRA_TYPES.map((option) => (
              <label key={option.value} className="flex items-center gap-2 rounded-xl border border-secondary-200 px-3 py-2">
                <input
                  type="radio"
                  name="workspace-type"
                  checked={type === option.value}
                  onChange={() => setType(option.value)}
                />
                <span>{t(option.labelKey)}</span>
              </label>
            ))}
          </fieldset>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('common.saving') : t('workspace.create')}
          </button>
        </form>
      </Dialog>
    </>
  );
}
