import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
import PageHeader from '../components/PageHeader';
import StaffManagement from '../components/StaffManagement';
import Notice from '../components/Notice';

export default function Staff() {
  const { t } = useI18n();
  const { businessId, canViewFeature } = useAuth();
  const { businessProfile } = useBusinessSettings();

  if (!canViewFeature('staff')) {
    return (
      <div className="min-w-0 space-y-6 pb-28 md:pb-0">
        <PageHeader
          title={t('staffManagement.title')}
          description={t('staffManagement.subtitle')}
        />
        <div className="card">
          <Notice title={t('staffManagement.permissionError')} tone="error" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 pb-28 md:pb-0">


      {businessProfile ? (
        <StaffManagement businessId={businessId} />
      ) : (
        <div className="card">
          <Notice title={t('staffManagement.businessRequired')} tone="warn" />
        </div>
      )}
    </div>
  );
}
