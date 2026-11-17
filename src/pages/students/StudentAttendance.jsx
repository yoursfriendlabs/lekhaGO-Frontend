import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCheck, History, MessageSquare, RefreshCw, Save } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import Avatar from '@/components/ui/Avatar';
import StudentsTabs from '@/components/students/StudentsTabs.jsx';
import { useStudentLookups } from '@/components/students/useStudentLookups';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_TONES,
  attendanceRateLabel,
  displayDateTime,
  isFutureDate,
  shiftDaysLabel,
  shiftTimeLabel,
  todayISO,
} from '@/lib/students/utils';

/** Unsaved marks survive a reload or a switch to another tab. */
function draftKey(businessId, shiftId, date) {
  return `mms_student_attendance_draft:${businessId}:${shiftId}:${date}`;
}

function readDraft(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDraft(key, draft) {
  try {
    if (Object.keys(draft).length) window.sessionStorage.setItem(key, JSON.stringify(draft));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Storage full or blocked — the marks stay in memory.
  }
}

function personName(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.name || value.user?.name || '';
}

export default function StudentAttendance() {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const { showSuccess } = useSnackbar();
  const { canViewStudents, canMarkAttendance, handleError } = useStudentsModule();
  const [searchParams, setSearchParams] = useSearchParams();
  const lookups = useStudentLookups({ courses: false, mine: !canViewStudents });

  const shiftId = searchParams.get('shiftId') || '';
  const date = searchParams.get('date') || todayISO();
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});
  const [openNotes, setOpenNotes] = useState(() => new Set());

  const storageKey = draftKey(businessId, shiftId, date);
  const future = isFutureDate(date);
  const canMark = canMarkAttendance && !future;

  const setParam = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  // Open the first shift when none is picked.
  useEffect(() => {
    if (!shiftId && lookups.shifts.length) setParam({ shiftId: String(lookups.shifts[0].id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookups.shifts, shiftId]);

  useEffect(() => {
    setDraft(shiftId ? readDraft(storageKey) : {});
    setOpenNotes(new Set());
    setSaveError('');
  }, [shiftId, storageKey]);

  const load = useCallback(async () => {
    if (!businessId || !shiftId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api.getStudentRoster({ shiftId, date });
      setRoster(payload);
    } catch (err) {
      const message = handleError(err);
      if (message) setError(message);
      setRoster(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, date, handleError, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => (Array.isArray(roster?.items) ? roster.items : []), [roster]);

  const effective = (item) => {
    const change = draft[item.enrollmentId];
    return {
      status: change && 'status' in change ? change.status : item.status || null,
      note: change && 'note' in change ? change.note : item.note || '',
    };
  };

  const updateDraft = (enrollmentId, patch) => {
    setDraft((current) => {
      const item = items.find((entry) => String(entry.enrollmentId) === String(enrollmentId));
      const merged = { ...(current[enrollmentId] || {}), ...patch };
      const next = { ...current };
      // Drop the change again when it matches what is saved.
      const sameStatus = !('status' in merged) || (merged.status || null) === (item?.status || null);
      const sameNote = !('note' in merged) || (merged.note || '') === (item?.note || '');
      if (sameStatus && sameNote) delete next[enrollmentId];
      else next[enrollmentId] = merged;
      writeDraft(storageKey, next);
      return next;
    });
  };

  const tapStatus = (item, status) => {
    if (!canMark) return;
    const current = effective(item).status;
    updateDraft(item.enrollmentId, { status: current === status ? null : status });
  };

  const markAllPresent = () => {
    if (!canMark) return;
    setDraft((current) => {
      const next = { ...current };
      items.forEach((item) => {
        if ((item.status || null) === 'present') {
          if (next[item.enrollmentId]) {
            const { status: _ignored, ...rest } = next[item.enrollmentId];
            if (Object.keys(rest).length && rest.note !== (item.note || '')) next[item.enrollmentId] = rest;
            else delete next[item.enrollmentId];
          }
        } else {
          next[item.enrollmentId] = { ...(next[item.enrollmentId] || {}), status: 'present' };
        }
      });
      writeDraft(storageKey, next);
      return next;
    });
  };

  const discard = () => {
    setDraft({});
    writeDraft(storageKey, {});
    setSaveError('');
  };

  const changedCount = Object.keys(draft).length;

  const save = async () => {
    if (!changedCount || saving || !canMark) return;
    setSaving(true);
    setSaveError('');
    try {
      const entries = items
        .filter((item) => draft[item.enrollmentId])
        .map((item) => {
          const value = effective(item);
          return { enrollmentId: item.enrollmentId, status: value.status || null, note: value.note || '' };
        });
      const payload = await api.saveStudentAttendance({ date, shiftId, entries });
      if (payload && Array.isArray(payload.items)) setRoster(payload);
      else await load();
      setDraft({});
      writeDraft(storageKey, {});
      showSuccess(t('students.attendance.saved'));
    } catch (err) {
      const message = handleError(err);
      if (message) setSaveError(`${t('students.attendance.saveFailed')} (${message})`);
    } finally {
      setSaving(false);
    }
  };

  const liveSummary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    items.forEach((item) => {
      const change = draft[item.enrollmentId];
      const status = change && 'status' in change ? change.status : item.status;
      if (status && counts[status] !== undefined) counts[status] += 1;
      else counts.unmarked += 1;
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, items]);

  const selectedShift = roster?.shift || lookups.shifts.find((shift) => String(shift.id) === String(shiftId));

  return (
    <div className="pb-24">
      <PageHeader
        title={t('students.attendance.title')}
        subtitle={t('students.attendance.subtitle')}
        action={(
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={load} disabled={loading || !shiftId}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        )}
      />
      <StudentsTabs />

      <section className="card space-y-4 p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <label className="label" htmlFor="roster-shift">{t('students.attendance.shift')}</label>
            <select
              id="roster-shift"
              className="input"
              value={shiftId}
              onChange={(event) => setParam({ shiftId: event.target.value })}
              disabled={lookups.loading}
            >
              {!shiftId ? <option value="">{t('students.attendance.pickShift')}</option> : null}
              {lookups.shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {[shift.name, shiftTimeLabel(shift)].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
            {selectedShift ? (
              <p className="mt-1 text-xs text-secondary-500">
                {[shiftTimeLabel(selectedShift), shiftDaysLabel(selectedShift, t)].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="roster-date">{t('students.attendance.date')}</label>
            <input
              id="roster-date"
              type="date"
              className="input"
              value={date}
              onChange={(event) => setParam({ date: event.target.value === todayISO() ? '' : event.target.value })}
            />
          </div>
        </div>

        {!lookups.loading && lookups.shifts.length === 0 ? (
          <Notice tone="info" title={t('students.attendance.noShifts')} />
        ) : null}
        {error ? <Notice tone="error" title={error} /> : null}
        {roster && roster.runsOnDate === false ? <Notice tone="warn" title={t('students.attendance.notRunning')} /> : null}
        {future ? <Notice tone="info" title={t('students.attendance.future')} /> : null}
        {!canMarkAttendance ? <Notice tone="info" title={t('students.attendance.viewOnly')} /> : null}

        {roster ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
            {[
              ['students', items.length, 'text-ink'],
              ['present', liveSummary.present, 'text-emerald-700 dark:text-emerald-300'],
              ['absent', liveSummary.absent, 'text-rose-600'],
              ['late', liveSummary.late, 'text-amber-700 dark:text-amber-300'],
              ['excused', liveSummary.excused, 'text-sky-700 dark:text-sky-300'],
              ['unmarked', liveSummary.unmarked, 'text-secondary-500'],
              ['rate', attendanceRateLabel(roster.summary?.attendanceRate), 'text-ink'],
            ].map(([key, value, tone]) => (
              <div key={key} className="rounded-xl border border-secondary-200 px-2 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-secondary-400">{t(`students.attendance.${key}`)}</p>
                <p className={`text-base font-semibold tabular-nums ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {shiftId ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canMark && items.length ? (
              <button type="button" className="btn-secondary flex items-center gap-2" onClick={markAllPresent}>
                <CheckCheck size={16} />
                {t('students.attendance.markAllPresent')}
              </button>
            ) : <span />}
            <Link to={`/app/students/attendance/history?shiftId=${shiftId}`} className="btn-ghost flex items-center gap-2">
              <History size={16} />
              {t('students.attendance.history')}
            </Link>
          </div>
        ) : null}

        {loading && !roster ? (
          <p className="py-8 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : roster && items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-10 text-center text-sm text-secondary-500">
            {t('students.attendance.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-secondary-100">
            {items.map((item) => {
              const value = effective(item);
              const changed = Boolean(draft[item.enrollmentId]);
              const noteOpen = openNotes.has(item.enrollmentId) || Boolean(value.note);
              const markedBy = personName(item.markedBy);
              return (
                <li key={item.enrollmentId} className={`py-3 ${changed ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={item.avatarUrl} name={item.name} size="sm" fallbackClassName="bg-secondary-100 text-secondary-600" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">
                          {item.name}
                          {item.studentCode ? <span className="ml-2 text-xs font-normal text-secondary-500">{item.studentCode}</span> : null}
                        </p>
                        <p className="truncate text-xs text-secondary-500">{item.course?.name || item.course || ''}</p>
                        {markedBy && !changed ? (
                          <p className="truncate text-[11px] text-secondary-400">
                            {t('students.attendance.markedBy', { name: markedBy, time: displayDateTime(item.markedAt) })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ATTENDANCE_STATUSES.map((status) => {
                        const on = value.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={on}
                            disabled={!canMark}
                            onClick={() => tapStatus(item, status)}
                            className={`min-h-[40px] rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-not-allowed ${
                              on ? ATTENDANCE_TONES[status] : 'border-secondary-200 text-secondary-500 hover:bg-secondary-50 disabled:opacity-60'
                            }`}
                          >
                            {t(`students.attendance.${status}`)}
                          </button>
                        );
                      })}
                      {canMark ? (
                        <button
                          type="button"
                          className="rounded-xl p-2 text-secondary-500 hover:bg-secondary-100"
                          title={t('students.attendance.addNote')}
                          onClick={() => setOpenNotes((current) => new Set(current).add(item.enrollmentId))}
                        >
                          <MessageSquare size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {noteOpen ? (
                    <input
                      className="input mt-2"
                      maxLength={500}
                      placeholder={t('students.attendance.note')}
                      value={value.note}
                      disabled={!canMark}
                      onChange={(event) => updateDraft(item.enrollmentId, { note: event.target.value })}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canMark && (changedCount > 0 || saveError) ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 px-4 md:bottom-6 md:left-16 md:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-secondary-200 bg-surface p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              {saveError ? (
                <p className="flex items-start gap-2 text-rose-600"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{saveError}</p>
              ) : (
                <p className="font-semibold text-ink">{t('students.attendance.unsaved', { count: changedCount })}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-ghost" onClick={discard} disabled={saving}>{t('students.attendance.discard')}</button>
              <button type="button" className="btn-primary flex items-center gap-2" onClick={save} disabled={saving || !changedCount}>
                <Save size={16} />
                {saving ? t('common.saving') : t('students.attendance.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
