import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, CalendarCheck, GraduationCap, Wallet } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import { useAuth } from '@/lib/auth';
import { useBusinessSettings } from '@/lib/business/businessSettings';
import { useI18n } from '@/lib/i18n.jsx';
import { getStudentTabs, hasStudentsAddon, pickStudentTab } from '@/lib/students';
import StudentList from './StudentList';
import StudentAttendance from './StudentAttendance';
import StudentDues from './StudentDues';
import StudentSetup from './StudentSetup';

const icons = { students: GraduationCap, attendance: CalendarCheck, dues: Wallet, setup: BookOpen };

export default function Students() {
  const { businessId, businessProfile: authProfile, workspaceBusy, sessionLoading, canViewFeature, canManageFeature } = useAuth();
  const { businessProfile, loading } = useBusinessSettings();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const enabled = hasStudentsAddon(authProfile || businessProfile);
  const canViewStudents = canViewFeature('students');
  const canViewAttendance = canViewFeature('studentAttendance');
  const canManageStudents = canManageFeature('students');
  const canManageAttendance = canManageFeature('studentAttendance');
  const tabs = getStudentTabs({ canViewStudents, canViewAttendance, canManageStudents });
  const tab = pickStudentTab(params.get('tab'), tabs);

  useEffect(() => {
    if (workspaceBusy || sessionLoading || !enabled || !tab || params.get('tab') === tab) return;
    const next = new URLSearchParams(params);
    next.set('tab', tab);
    if (!canViewStudents) next.delete('student');
    setParams(next, { replace: true });
  }, [workspaceBusy, sessionLoading, enabled, tab, params, setParams, canViewStudents]);

  if (workspaceBusy || sessionLoading) return <Notice title={t('common.loading')} />;
  if (!businessId) return <Notice title={t('students.selectBusiness')} />;
  if (!enabled) return <Notice title={loading ? t('common.loading') : t('students.addonRequired')} description={loading ? undefined : t('students.addonHint')} />;
  if (!tab) return <Notice title={t('students.noAccess')} />;

  const changeTab = (nextTab) => {
    const next = new URLSearchParams(params);
    next.set('tab', nextTab);
    next.delete('student');
    setParams(next);
  };
  return <section className="space-y-5">
    <PageHeader title={t('students.title')} subtitle={t(canViewStudents ? 'students.subtitle' : 'students.tutorSubtitle')} />
    <nav className="flex flex-wrap gap-2 border-b border-secondary-200 pb-3" aria-label={t('students.title')}>
      {tabs.map((key) => {
        const Icon = icons[key];
        return <button key={key} type="button" disabled={attendanceDirty && tab !== key} aria-current={tab === key ? 'page' : undefined} onClick={() => changeTab(key)}
          className={'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ' + (tab === key ? 'bg-primary text-white' : 'bg-surface text-secondary-600 hover:bg-secondary-100')}>
          <Icon size={17} aria-hidden="true" />{t('students.tabs.' + key)}
        </button>;
      })}
    </nav>
    <div key={businessId + ':' + tab + ':' + canManageStudents + ':' + canManageAttendance}>
      {tab === 'students' && <StudentList canManage={canManageStudents} />}
      {tab === 'attendance' && <StudentAttendance canManage={canManageAttendance} onDirtyChange={setAttendanceDirty} />}
      {tab === 'dues' && <StudentDues canManage={canManageStudents} />}
      {tab === 'setup' && canManageStudents && <StudentSetup />}
    </div>
  </section>;
}
