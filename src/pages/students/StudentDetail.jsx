import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarCheck, Pencil, Phone, Plus, ReceiptText, Trash2, UserX, UserCheck } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Avatar from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import StudentsTabs from '@/components/students/StudentsTabs.jsx';
import StudentFormDialog from '@/components/students/StudentFormDialog.jsx';
import EnrollDialog from '@/components/students/EnrollDialog.jsx';
import EnrollmentCard from '@/components/students/EnrollmentCard.jsx';
import { useEnrollmentActions } from '@/components/students/useEnrollmentActions.jsx';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { formatMoney } from '@/lib/money/formatting';
import { attendanceRateLabel, displayDate, STATUS_BADGE, toNumber } from '@/lib/students/utils';

const ENROLLMENT_ORDER = { active: 0, completed: 1, dropped: 2 };

export default function StudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showError, showSuccess } = useSnackbar();
  const { canManageStudents, handleError } = useStudentsModule();

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await api.getStudent(studentId, { force: true });
      setStudent(payload?.student || payload);
    } catch (err) {
      const message = handleError(err, t('students.detail.notFound'));
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }, [handleError, studentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useEnrollmentActions({ onChanged: load, studentName: student?.name });

  const setStatus = async (status) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateStudent(studentId, { status });
      showSuccess(t('students.detail.updated'));
      await load();
    } catch (err) {
      const message = handleError(err);
      if (message) showError(message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteStudent(studentId);
      showSuccess(t('students.detail.deleted'));
      navigate('/app/students', { replace: true });
    } catch (err) {
      if (err?.status === 409) {
        setDeleteOpen(false);
        setDeleteBlocked(true);
      } else {
        const message = handleError(err);
        if (message) showError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading && !student) {
    return (
      <div>
        <StudentsTabs />
        <p className="py-16 text-center text-sm text-secondary-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <StudentsTabs />
        <Notice tone="error" title={error || t('students.detail.notFound')} />
        <Link to="/app/students" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          {t('students.detail.back')}
        </Link>
      </div>
    );
  }

  const enrollments = [...(student.enrollments || [])].sort(
    (a, b) => (ENROLLMENT_ORDER[a.status] ?? 9) - (ENROLLMENT_ORDER[b.status] ?? 9)
      || String(b.startDate || '').localeCompare(String(a.startDate || '')),
  );
  const attendance = student.attendance || {};
  const isActive = student.status !== 'inactive';

  return (
    <div className="space-y-5">
      <Link to="/app/students" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-600 hover:text-primary">
        <ArrowLeft size={16} />
        {t('students.detail.back')}
      </Link>
      <StudentsTabs />

      {error ? <Notice tone="error" title={error} /> : null}

      <section className="card p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar src={student.avatarUrl} name={student.name} size="lg" fallbackClassName="bg-secondary-100 text-secondary-600" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="page-title truncate">{student.name}</h2>
                <Badge size="sm" variant={STATUS_BADGE[student.status] || 'default'}>{t(`students.status.${student.status || 'active'}`)}</Badge>
              </div>
              <p className="mt-1 text-sm text-secondary-500">
                {[student.studentCode, student.email].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary-600">
                {student.phone ? (
                  <a href={`tel:${student.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
                    <Phone size={14} />
                    {student.phone}
                  </a>
                ) : null}
                {student.guardianName || student.guardianPhone ? (
                  <span>
                    {t('students.detail.guardian')}: {student.guardianName || ''}
                    {student.guardianPhone ? (
                      <a href={`tel:${student.guardianPhone}`} className="ml-1 text-primary hover:underline">{student.guardianPhone}</a>
                    ) : null}
                  </span>
                ) : null}
                {student.joinedAt ? <span>{t('students.detail.joined')}: {displayDate(student.joinedAt)}</span> : null}
                {student.dateOfBirth ? <span>{t('students.detail.born')}: {displayDate(student.dateOfBirth)}</span> : null}
              </div>
              {student.address ? <p className="mt-1 text-sm text-secondary-500">{student.address}</p> : null}
              {student.notes ? <p className="mt-2 text-sm text-secondary-600">{student.notes}</p> : null}
            </div>
          </div>

          {canManageStudents ? (
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => setEditOpen(true)}>
                <Pencil size={15} />
                {t('students.detail.edit')}
              </button>
              <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => setStatus(isActive ? 'inactive' : 'active')} disabled={busy}>
                {isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                {isActive ? t('students.detail.markInactive') : t('students.detail.markActive')}
              </button>
              <button type="button" className="btn-ghost flex items-center gap-2 text-rose-600" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={15} />
                {t('students.detail.delete')}
              </button>
            </div>
          ) : null}
        </div>

        {deleteBlocked ? (
          <div className="mt-4">
            <Notice tone="warn" title={t('students.detail.deleteBlocked')} />
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-secondary-200 p-4">
            <p className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.detail.courseFeesDue')}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${toNumber(student.courseFeeDue) > 0 ? 'text-rose-600' : 'text-ink'}`}>
              {formatMoney(t, student.courseFeeDue)}
            </p>
          </div>
          <div className="rounded-2xl border border-secondary-200 p-4">
            <p className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.detail.accountBalance')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{formatMoney(t, student.partyBalance)}</p>
            <p className="mt-1 text-xs text-secondary-500">{t('students.detail.accountBalanceHint')}</p>
          </div>
          {student.partyId ? (
            <Link
              to={`/app/reports?tab=party&partyId=${student.partyId}`}
              className="flex items-center gap-3 rounded-2xl border border-secondary-200 p-4 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              <ReceiptText size={18} />
              {t('students.detail.ledger')}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="card space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
            <BookOpen size={18} />
            {t('students.detail.enrollments')}
          </h3>
          {canManageStudents && isActive ? (
            <button type="button" className="btn-primary flex items-center gap-2" onClick={() => setEnrollOpen(true)}>
              <Plus size={16} />
              {t('students.detail.enroll')}
            </button>
          ) : null}
        </div>
        {enrollments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-8 text-center text-sm text-secondary-500">
            {t('students.detail.noEnrollments')}
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {enrollments.map((enrollment) => (
              <EnrollmentCard
                key={enrollment.id}
                enrollment={enrollment}
                canManage={canManageStudents}
                onCollect={actions.onCollect}
                onChangeShifts={actions.onChangeShifts}
                onChangeEndDate={actions.onChangeEndDate}
                onComplete={actions.onComplete}
                onDrop={actions.onDrop}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
            <CalendarCheck size={18} />
            {t('students.detail.attendance')}
          </h3>
          <Link to={`/app/students/attendance/history?studentId=${student.id}`} className="btn-secondary">
            {t('students.detail.viewHistory')}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['present', 'text-emerald-700 dark:text-emerald-300'],
            ['absent', 'text-rose-600'],
            ['late', 'text-amber-700 dark:text-amber-300'],
            ['excused', 'text-sky-700 dark:text-sky-300'],
          ].map(([key, tone]) => (
            <div key={key} className="rounded-2xl border border-secondary-200 p-3 text-center">
              <p className="text-[11px] uppercase tracking-wide text-secondary-400">{t(`students.attendance.${key}`)}</p>
              <p className={`text-lg font-semibold tabular-nums ${tone}`}>{toNumber(attendance[key])}</p>
            </div>
          ))}
          <div className="col-span-2 rounded-2xl border border-secondary-200 p-3 text-center sm:col-span-1">
            <p className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.detail.attendanceRate')}</p>
            <p className="text-lg font-semibold tabular-nums text-ink">{attendanceRateLabel(attendance.attendanceRate)}</p>
          </div>
        </div>
      </section>

      <StudentFormDialog
        isOpen={editOpen}
        student={student}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          showSuccess(t('students.detail.updated'));
          load();
        }}
      />
      <EnrollDialog
        isOpen={enrollOpen}
        student={student}
        onClose={() => setEnrollOpen(false)}
        onSaved={() => {
          setEnrollOpen(false);
          showSuccess(t('students.enroll.done'));
          load();
        }}
      />
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        confirming={busy}
        title={t('students.detail.deleteTitle')}
        description={t('students.detail.deleteDescription')}
        confirmLabel={t('students.detail.delete')}
      />
      {actions.dialogs}
    </div>
  );
}
