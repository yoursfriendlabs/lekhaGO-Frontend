import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog.tsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import StudentsTabs from '@/components/students/StudentsTabs.jsx';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { formatMoney } from '@/lib/money/formatting';
import { asList, DURATION_UNITS, toNumber } from '@/lib/students/utils';

const EMPTY_COURSE = {
  name: '',
  code: '',
  description: '',
  durationValue: '3',
  durationUnit: 'month',
  fee: '',
  isActive: true,
};

function courseToForm(course) {
  return {
    name: course.name || '',
    code: course.code || '',
    description: course.description || '',
    durationValue: String(course.durationValue ?? ''),
    durationUnit: course.durationUnit || 'month',
    fee: String(course.fee ?? ''),
    isActive: course.isActive !== false,
  };
}

function activeEnrollmentList(course) {
  return Array.isArray(course?.activeEnrollments) ? course.activeEnrollments : [];
}

function activeEnrollmentCount(course) {
  if (Array.isArray(course?.activeEnrollments)) return course.activeEnrollments.length;
  return toNumber(course?.activeEnrollments ?? course?.activeEnrollmentCount);
}

export default function StudentCourses() {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const { canManageStudents, handleError } = useStudentsModule();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [activeFilter, setActiveFilter] = useState('');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dialog, setDialog] = useState(null); // { id?, form }
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [inactiveOffer, setInactiveOffer] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api.listStudentCourses({
        search: debouncedSearch.trim() || undefined,
        active: activeFilter || undefined,
        limit: 200,
      }, { force: true });
      setCourses(asList(payload));
    } catch (err) {
      const message = handleError(err);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, businessId, debouncedSearch, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (course) => {
    setDetail({ ...course, loading: true });
    try {
      const payload = await api.getStudentCourse(course.id, { force: true });
      setDetail({ ...(payload?.course || payload), loading: false });
    } catch (err) {
      const message = handleError(err);
      if (message) showError(message);
      setDetail(null);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!dialog || saving) return;
    const { form, id } = dialog;
    const duration = Number(form.durationValue);
    if (!form.name.trim()) {
      setFormError(t('students.courses.nameRequired'));
      return;
    }
    if (!Number.isInteger(duration) || duration <= 0) {
      setFormError(t('students.courses.durationRequired'));
      return;
    }
    if (form.fee === '' || toNumber(form.fee, -1) < 0) {
      setFormError(t('students.courses.feeRequired'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        durationValue: duration,
        durationUnit: form.durationUnit,
        fee: toNumber(form.fee),
        isActive: Boolean(form.isActive),
      };
      if (id) await api.updateStudentCourse(id, body);
      else await api.createStudentCourse(body);
      showSuccess(t('students.courses.saved'));
      setDialog(null);
      load();
    } catch (err) {
      const message = handleError(err);
      if (message) setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await api.deleteStudentCourse(deleteTarget.id);
      showSuccess(t('students.courses.deleted'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      if (err?.status === 409) {
        setInactiveOffer(deleteTarget);
        setDeleteTarget(null);
      } else {
        const message = handleError(err);
        if (message) showError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const markInactive = async () => {
    if (!inactiveOffer || busy) return;
    setBusy(true);
    try {
      await api.updateStudentCourse(inactiveOffer.id, { isActive: false });
      showSuccess(t('students.courses.saved'));
      setInactiveOffer(null);
      load();
    } catch (err) {
      const message = handleError(err);
      if (message) showError(message);
    } finally {
      setBusy(false);
    }
  };

  const updateForm = (patch) => setDialog((current) => ({ ...current, form: { ...current.form, ...patch } }));

  return (
    <div>
      <PageHeader
        title={t('students.courses.title')}
        subtitle={t('students.courses.subtitle')}
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </button>
            {canManageStudents ? (
              <button
                type="button"
                className="btn-primary flex items-center gap-2"
                onClick={() => {
                  setFormError('');
                  setDialog({ id: null, form: { ...EMPTY_COURSE } });
                }}
              >
                <Plus size={16} />
                {t('students.courses.add')}
              </button>
            ) : null}
          </div>
        )}
      />
      <StudentsTabs />

      <section className="card space-y-4 p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              className="input pl-9"
              type="search"
              value={search}
              placeholder={t('students.courses.searchPlaceholder')}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select className="input" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
            <option value="">{t('students.courses.showAll')}</option>
            <option value="true">{t('students.courses.showActive')}</option>
            <option value="false">{t('students.courses.showInactive')}</option>
          </select>
        </div>

        {error ? <Notice tone="error" title={error} /> : null}

        {loading && courses.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : courses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-10 text-center text-sm text-secondary-500">
            {t('students.courses.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-secondary-100 text-[11px] uppercase tracking-wide text-secondary-400">
                  <th className="py-2 pr-3 font-semibold">{t('students.courses.name')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('students.courses.length')}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t('students.courses.fee')}</th>
                  <th className="py-2 pr-3 text-right font-semibold">{t('students.courses.activeEnrollments')}</th>
                  <th className="py-2 text-right font-semibold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} className="border-b border-secondary-50 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-ink">
                        {course.name}
                        {course.code ? <span className="ml-2 text-xs font-normal text-secondary-500">{course.code}</span> : null}
                      </p>
                      {course.description ? <p className="max-w-xs truncate text-xs text-secondary-500">{course.description}</p> : null}
                      {course.isActive === false ? (
                        <Badge size="sm" variant="inactive" className="mt-1">{t('students.status.inactive')}</Badge>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-secondary-600">{course.durationLabel || `${course.durationValue} ${course.durationUnit}`}</td>
                    <td className="py-3 pr-3 text-right font-semibold tabular-nums">{formatMoney(t, course.fee)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-secondary-600">{activeEnrollmentCount(course)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="rounded-lg p-2 text-secondary-500 hover:bg-secondary-100" title={t('students.courses.details')} onClick={() => openDetail(course)}>
                          <Eye size={16} />
                        </button>
                        {canManageStudents ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-secondary-500 hover:bg-secondary-100"
                              title={t('students.courses.edit')}
                              onClick={() => {
                                setFormError('');
                                setDialog({ id: course.id, form: courseToForm(course) });
                              }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button type="button" className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title={t('common.delete')} onClick={() => setDeleteTarget(course)}>
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        isOpen={Boolean(dialog)}
        onClose={saving ? () => {} : () => setDialog(null)}
        title={dialog?.id ? t('students.courses.edit') : t('students.courses.add')}
        size="md"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)} disabled={saving}>{t('common.cancel')}</button>
            <button type="submit" form="course-form" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        )}
      >
        {dialog ? (
          <form id="course-form" className="space-y-4" onSubmit={save}>
            {formError ? <Notice tone="error" title={formError} /> : null}
            {dialog.id ? <Notice tone="info" title={t('students.courses.changeHint')} /> : null}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                <label className="label" htmlFor="course-name">{t('students.courses.name')}</label>
                <input id="course-name" className="input" maxLength={255} value={dialog.form.name} onChange={(event) => updateForm({ name: event.target.value })} autoFocus />
              </div>
              <div>
                <label className="label" htmlFor="course-code">{t('students.courses.code')}</label>
                <input id="course-code" className="input" maxLength={50} value={dialog.form.code} onChange={(event) => updateForm({ code: event.target.value })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="course-description">{t('students.courses.description')}</label>
              <textarea id="course-description" rows={2} maxLength={2000} className="input" value={dialog.form.description} onChange={(event) => updateForm({ description: event.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="course-duration">{t('students.courses.durationValue')}</label>
                <input id="course-duration" type="number" min="1" step="1" inputMode="numeric" className="input" value={dialog.form.durationValue} onChange={(event) => updateForm({ durationValue: event.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="course-unit">{t('students.courses.durationUnit')}</label>
                <select id="course-unit" className="input" value={dialog.form.durationUnit} onChange={(event) => updateForm({ durationUnit: event.target.value })}>
                  {DURATION_UNITS.map((unit) => (
                    <option key={unit} value={unit}>{t(`students.units.${unit}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="course-fee">{t('students.courses.fee')}</label>
                <input id="course-fee" type="number" min="0" step="any" inputMode="decimal" className="input" value={dialog.form.fee} onChange={(event) => updateForm({ fee: event.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-secondary-700">
              <input type="checkbox" checked={dialog.form.isActive} onChange={(event) => updateForm({ isActive: event.target.checked })} />
              {t('students.courses.isActive')}
            </label>
          </form>
        ) : null}
      </Dialog>

      <Dialog isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name || t('students.courses.details')} size="md">
        {detail ? (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.courses.length')}</dt>
                <dd className="font-semibold text-ink">{detail.durationLabel || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.courses.fee')}</dt>
                <dd className="font-semibold tabular-nums text-ink">{formatMoney(t, detail.fee)}</dd>
              </div>
            </dl>
            {detail.description ? <p className="text-secondary-600">{detail.description}</p> : null}
            <p className="text-xs text-secondary-500">{t('students.courses.changeHint')}</p>
            <div>
              <p className="label">{t('students.courses.students')} ({activeEnrollmentCount(detail)})</p>
              {detail.loading ? (
                <p className="text-secondary-500">{t('common.loading')}</p>
              ) : activeEnrollmentList(detail).length ? (
                <ul className="divide-y divide-secondary-100">
                  {activeEnrollmentList(detail).map((enrollment) => (
                    <li key={enrollment.id} className="flex items-center justify-between gap-3 py-2">
                      <Link className="font-semibold text-primary hover:underline" to={`/app/students/${enrollment.studentId || enrollment.student?.id}`}>
                        {enrollment.student?.name || enrollment.name || '—'}
                      </Link>
                      {toNumber(enrollment.fees?.due) > 0 ? (
                        <span className="tabular-nums text-rose-600">{formatMoney(t, enrollment.fees.due)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Link className="text-primary hover:underline" to={`/app/students/enrollments?courseId=${detail.id}&status=active`}>
                  {t('students.tabs.enrollments')}
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        confirming={busy}
        title={t('students.courses.deleteTitle')}
        description={t('students.courses.deleteDescription')}
      />
      <ConfirmDialog
        isOpen={Boolean(inactiveOffer)}
        onClose={() => setInactiveOffer(null)}
        onConfirm={markInactive}
        confirming={busy}
        variant="primary"
        title={t('students.courses.markInactive')}
        description={t('students.courses.deleteBlocked')}
        confirmLabel={t('students.courses.markInactive')}
      />
    </div>
  );
}
