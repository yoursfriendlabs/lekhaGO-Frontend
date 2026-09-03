import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronDown, Home, Plus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n.jsx';
import { useBusinessSettings } from '../../lib/business/businessSettings.jsx';
import { findWorkspace } from '../../lib/business/workspaces';
import { Dialog } from '../ui/Dialog';

function workspaceIcon(item) {
  if (item?.isPersonal) return Home;
  if (item?.isOwner) return Building2;
  return Users;
}

function typeLabel(item, t) {
  if (item?.isPersonal) return t('workspaces.personal');
  if (item?.label && item.label !== item.type) return item.label;
  if (item?.type === 'retail') return t('workspaces.typeRetail');
  if (item?.type === 'cafe') return t('workspaces.typeCafe');
  return item?.label || item?.type || t('workspaces.business');
}

function roleLabel(item, t) {
  return item?.isOwner ? t('workspaces.owner') : t('workspaces.staff');
}

export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { businessProfile } = useBusinessSettings();
  const {
    user,
    businessId,
    business,
    workspaces,
    canCreateBusiness,
    extraBusinessTypes,
    workspaceBusy,
    refreshWorkspaces,
    switchWorkspace,
    createWorkspace,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', type: extraBusinessTypes[0] || 'retail' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  const current = findWorkspace(workspaces, businessId);
  const businessLabel = String(business?.name || current?.name || businessProfile?.label || '').trim();
  const userLabel = String(user?.name || '').trim();
  const title = businessLabel || userLabel || t('topbar.welcome');

  useEffect(() => {
    if (!open) return undefined;

    refreshWorkspaces().catch(() => {});

    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, refreshWorkspaces]);

  const handleSwitch = async (item) => {
    if (!item?.id || item.id === businessId || workspaceBusy) return;
    setError('');
    try {
      await switchWorkspace(item.id);
      setOpen(false);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err?.message || t('workspaces.switchFailed'));
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const name = createForm.name.trim();
    if (!name || creating) return;

    setCreating(true);
    setError('');
    try {
      await createWorkspace({ name, type: createForm.type });
      setCreateOpen(false);
      setCreateForm({ name: '', type: extraBusinessTypes[0] || 'retail' });
      setOpen(false);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err?.message || t('workspaces.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500">{t('topbar.workspace')}</p>
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-1 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('workspaces.switch')}
        disabled={workspaceBusy}
      >
        <h2 className="truncate font-serif text-base text-ink sm:text-lg">{title}</h2>
        <ChevronDown className={`h-4 w-4 shrink-0 text-secondary-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {current ? (
        <p className="mt-1 truncate text-xs font-medium text-secondary-500">
          {[typeLabel(current, t), roleLabel(current, t)].filter(Boolean).join(' · ')}
        </p>
      ) : null}

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-secondary-200 bg-surface shadow-xl">
          <div className="border-b border-secondary-100 px-3 py-2">
            <p className="text-xs font-semibold text-secondary-500">{t('workspaces.switch')}</p>
            {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
          </div>
          <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
            {workspaces.length ? workspaces.map((item) => {
              const Icon = workspaceIcon(item);
              const selected = item.id === businessId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={workspaceBusy}
                    onClick={() => handleSwitch(item)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      selected ? 'bg-primary/10' : 'hover:bg-mist'
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-secondary-500">
                        {[typeLabel(item, t), roleLabel(item, t)].join(' · ')}
                      </span>
                    </span>
                    {selected ? <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                  </button>
                </li>
              );
            }) : (
              <li className="px-3 py-4 text-sm text-secondary-500">{t('workspaces.empty')}</li>
            )}
          </ul>
          {canCreateBusiness ? (
            <div className="border-t border-secondary-100 p-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                onClick={() => {
                  setCreateForm({ name: '', type: extraBusinessTypes[0] || 'retail' });
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t('workspaces.addBusiness')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog
        isOpen={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title={t('workspaces.addBusiness')}
        size="sm"
        footer={(
          <>
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="create-workspace-form" className="btn-primary" disabled={creating || !createForm.name.trim()}>
              {creating ? t('common.saving') : t('workspaces.create')}
            </button>
          </>
        )}
      >
        <form id="create-workspace-form" className="space-y-4" onSubmit={handleCreate}>
          <p className="text-sm text-secondary-600">{t('workspaces.addBusinessHint')}</p>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <label className="block">
            <span className="label">{t('workspaces.name')}</span>
            <input
              className="input mt-1"
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              required
              autoFocus
            />
          </label>
          <label className="block">
            <span className="label">{t('workspaces.type')}</span>
            <select
              className="input mt-1"
              value={createForm.type}
              onChange={(event) => setCreateForm((current) => ({ ...current, type: event.target.value }))}
            >
              {(extraBusinessTypes.length ? extraBusinessTypes : ['retail', 'cafe']).map((type) => (
                <option key={type} value={type}>
                  {type === 'cafe' ? t('workspaces.typeCafe') : t('workspaces.typeRetail')}
                </option>
              ))}
            </select>
          </label>
        </form>
      </Dialog>
    </div>
  );
}
