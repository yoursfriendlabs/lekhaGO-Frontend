import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Notice from '../Notice.jsx';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useBusinessSettings } from '../../lib/businessSettings';
import { useI18n } from '../../lib/i18n.jsx';

function getBusinessName(business, user) {
  return business?.name || business?.businessName || user?.businessName || '';
}

export default function ProfileSettingsPanel({ isOwner = false }) {
  const { t } = useI18n();
  const { user, business, syncSession } = useAuth();
  const { syncBusinessName } = useBusinessSettings();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    businessName: '',
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: 'info', message: '' });

  useEffect(() => {
    setForm({
      name: user?.name || '',
      phone: user?.phone || '',
      businessName: getBusinessName(business, user),
    });
  }, [business, user]);

  const businessFieldHint = useMemo(
    () => (isOwner ? t('settingsPage.profile.businessOwnerHint') : t('settingsPage.profile.businessStaffHint')),
    [isOwner, t]
  );

  const handleChange = (field, value) => {
    setStatus({ type: 'info', message: '' });
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus({ type: 'info', message: '' });

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        businessName: isOwner ? form.businessName.trim() : getBusinessName(business, user),
      };
      const response = await api.updateCurrentUser(payload);
      const nextSnapshot = syncSession(response, {
        user: {
          ...(user || {}),
          name: payload.name,
          phone: payload.phone,
        },
        business: isOwner
          ? {
            ...(business || {}),
            name: payload.businessName,
            businessName: payload.businessName,
          }
          : business,
      });

      if (isOwner && payload.businessName) {
        syncBusinessName(nextSnapshot?.businessId, nextSnapshot?.business || { name: payload.businessName });
      }

      setStatus({ type: 'success', message: t('settingsPage.profile.saved') });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || t('auth.errors.generic') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t('settingsPage.profile.eyebrow')}
          </p>
          <h2 className="mt-2 font-serif text-xl text-slate-900 dark:text-white">
            {t('settingsPage.tabs.profile')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('settingsPage.profile.subtitle')}
          </p>
        </div>

        {status.message ? (
          <Notice
            title={status.message}
            tone={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : 'info'}
          />
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="label" htmlFor="profile-name">{t('auth.name')}</label>
              <input
                id="profile-name"
                className="input"
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder={t('settingsPage.profile.namePlaceholder')}
              />
            </div>

            <div className="space-y-1">
              <label className="label" htmlFor="profile-phone">{t('adminPage.currentUser.phone')}</label>
              <input
                id="profile-phone"
                className="input"
                type="tel"
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                placeholder={t('settingsPage.profile.phonePlaceholder')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="label" htmlFor="profile-business-name">{t('settingsPage.profile.businessName')}</label>
            <input
              id="profile-business-name"
              className="input"
              value={form.businessName}
              onChange={(event) => handleChange('businessName', event.target.value)}
              placeholder={t('settingsPage.profile.businessPlaceholder')}
              disabled={!isOwner}
            />
            <p className="text-xs text-slate-400">{businessFieldHint}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="submit" className="btn-primary px-8" disabled={saving}>
              {saving ? t('settingsPage.profile.saving') : t('settingsPage.profile.saveCta')}
            </button>
            {status.type === 'success' ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 size={16} />
                {t('settingsPage.profile.saved')}
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
