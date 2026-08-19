import ThemeSelector from '../ThemeSelector.jsx';
import { useI18n } from '../../lib/i18n.jsx';

export default function AppearanceSettingsPanel() {
  const { t } = useI18n();

  return (
    <section className="card space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-500">
          {t('settingsPage.tabs.appearance')}
        </p>
        <h3 className="mt-2 font-serif text-xl text-ink">{t('theme.title')}</h3>
        <p className="page-subtitle">{t('theme.subtitle')}</p>
      </div>
      <ThemeSelector />
    </section>
  );
}
