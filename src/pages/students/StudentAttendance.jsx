import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { formatMaybeDate, todayISODate } from '@/lib/dates/datetime';
import { ATTENDANCE_STATUSES, attendanceTone, buildAttendanceEntries, describeShift, markAllUnmarked } from '@/lib/students';
import { Badge } from '@/components/ui/Badge';
import Notice from '@/components/ui/Notice';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Field, ResourceState, useStudentResource } from '@/components/students/StudentUi';

export default function StudentAttendance({ canManage, onDirtyChange }) {
  const { t } = useI18n();
  const [shiftId, setShiftId] = useState('');
  const [date, setDate] = useState(todayISODate);
  const [marks, setMarks] = useState({});
  const [roster, setRoster] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [mode, setMode] = useState('roster');
  const [leavingTo, setLeavingTo] = useState(null);
  const navigate = useNavigate();
  const loadShifts = useCallback(() => api.listStudentShifts({}, { force: true }), []);
  const shiftsResource = useStudentResource(loadShifts);
  const shifts = shiftsResource.data?.items || [];
  useEffect(() => {
    if (!shiftId && shifts.length) setShiftId((shifts.find((shift) => shift.isActive !== false) || shifts[0]).id);
  }, [shiftId, shifts]);
  const load = useCallback(() => shiftId ? api.getStudentRoster({ shiftId, date }) : Promise.resolve(null), [shiftId, date]);
  const resource = useStudentResource(load);
  useEffect(() => { setRoster(resource.data); setMarks({}); }, [resource.data]);
  const entries = useMemo(() => buildAttendanceEntries(roster?.items || [], marks), [roster, marks]);
  const dirty = entries.length > 0;
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    const guardLink = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank') return;
      const target = new URL(link.href);
      if (target.origin !== window.location.origin) return;
      event.preventDefault(); event.stopPropagation();
      setLeavingTo(target.pathname + target.search + target.hash);
    };
    document.addEventListener('click', guardLink, true);
    return () => { window.removeEventListener('beforeunload', guard); document.removeEventListener('click', guardLink, true); };
  }, [dirty]);
  const mark = (item, patch) => setMarks((current) => ({ ...current, [item.enrollmentId]: { status: item.status, note: item.note || '', ...current[item.enrollmentId], ...patch } }));
  const save = async () => {
    if (!canManage || busy || !entries.length || date > todayISODate()) return;
    setBusy(true); setNotice(null);
    try {
      const updated = await api.markStudentAttendance({ date, shiftId, entries });
      setRoster(updated); setMarks({}); setNotice({ tone: 'success', title: t('students.attendance.saved') });
    } catch (err) { setNotice({ tone: 'error', title: err.message }); } finally { setBusy(false); }
  };
  return <div className="space-y-4">
    {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'}><Notice {...notice} /></div>}
    <div className="card space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('students.shifts.shift')}><select className="input" disabled={dirty || busy || shiftsResource.loading} value={shiftId} onChange={(event) => { setShiftId(event.target.value); setNotice(null); }}><option value="">{t('students.shifts.select')}</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name + (shift.isActive === false ? ' · ' + t('students.status.inactive') : '')}</option>)}</select></Field>
        {mode === 'roster' && <Field label={t('students.attendance.date')}><input className="input" type="date" max={todayISODate()} required disabled={dirty || busy} value={date} onChange={(event) => { if (event.target.value) { setDate(event.target.value); setNotice(null); } }} /></Field>}
      </div>
      {shiftId && <p className="text-xs text-secondary-500">{describeShift(shifts.find((shift) => shift.id === shiftId), t)}</p>}
      <div className="flex flex-wrap gap-2">
        {['roster', 'history'].map((key) => <button key={key} type="button" aria-pressed={mode === key} disabled={dirty || busy} className={mode === key ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode(key)}>{t('students.attendance.' + key)}</button>)}
      </div>
      {dirty && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><p>{t('students.attendance.unsaved', { count: entries.length })}</p><button type="button" className="btn-secondary" disabled={busy} onClick={() => setMarks({})}>{t('students.attendance.discard')}</button></div>}
    </div>
    <ResourceState resource={shiftsResource} empty={!shifts.length} emptyTitle={t('students.shifts.noActive')} emptyDescription={t('students.attendance.setupHint')}>
      {mode === 'history' && shiftId ? <ShiftHistory shiftId={shiftId} /> : shiftId && <div className="card space-y-4 p-4">
        <ResourceState resource={resource} empty={!roster?.items.length} emptyTitle={t('students.attendance.empty')} emptyDescription={t('students.attendance.emptyHint')}>
          {roster && <>
            {!roster.runsOnDate && <Notice tone="warn" title={t('students.attendance.offDay')} description={t('students.attendance.offDayHint')} />}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge>{t('students.attendance.count', { count: roster.items.length })}</Badge>
                {ATTENDANCE_STATUSES.map((status) => <Badge key={status} variant={attendanceTone(status)}>{t('students.attendance.statuses.' + status) + ': ' + roster.items.filter((item) => (marks[item.enrollmentId] ? marks[item.enrollmentId].status : item.status) === status).length}</Badge>)}
              </div>
              {canManage && <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={busy || date > todayISODate()} onClick={() => setMarks((current) => markAllUnmarked(roster.items, current))}><CheckCheck size={16} aria-hidden="true" />{t('students.attendance.markAll')}</button>}
            </div>
            <div className="divide-y divide-secondary-100">
              {roster.items.map((item) => {
                const current = marks[item.enrollmentId] || { status: item.status, note: item.note || '' };
                return <div key={item.enrollmentId} className="grid gap-3 py-4 lg:grid-cols-[minmax(180px,1fr)_minmax(300px,2fr)]">
                  <div><p className="font-semibold text-ink">{item.name}</p><p className="mt-1 text-xs text-secondary-500">{[item.studentCode, item.course?.name].filter(Boolean).join(' · ')}</p>{item.markedBy && <p className="mt-1 text-xs text-secondary-500">{t('students.attendance.markedBy') + ': ' + item.markedBy.name}</p>}</div>
                  <fieldset disabled={!canManage || busy || date > todayISODate()} className="min-w-0 space-y-3">
                    <legend className="sr-only">{t('students.attendance.markFor', { name: item.name })}</legend>
                    <div className="flex flex-wrap gap-2">
                      {ATTENDANCE_STATUSES.map((status) => <button key={status} type="button" aria-pressed={current.status === status} aria-label={t('students.attendance.markLabel', { name: item.name, status: t('students.attendance.statuses.' + status) })} className={'min-h-11 rounded-xl border px-3 text-sm font-medium transition ' + (current.status === status ? 'border-primary bg-primary text-white' : 'border-secondary-200 text-secondary-600 hover:bg-secondary-50')} onClick={() => mark(item, { status })}>{t('students.attendance.statuses.' + status)}</button>)}
                      {current.status && canManage && <button type="button" className="btn-ghost min-h-11" aria-label={t('students.attendance.clearLabel', { name: item.name })} onClick={() => mark(item, { status: null, note: '' })}>{t('common.clear')}</button>}
                      {!current.status && <Badge variant="pending">{t('students.attendance.unmarked')}</Badge>}
                    </div>
                    <input className="input" aria-label={t('students.attendance.noteFor', { name: item.name })} placeholder={t('students.attendance.notePlaceholder')} maxLength={500} disabled={!current.status} value={current.note || ''} onChange={(event) => mark(item, { note: event.target.value })} />
                  </fieldset>
                </div>;
              })}
            </div>
            {canManage && <div className="flex justify-end border-t border-secondary-200 pt-4"><button type="button" className="btn-primary inline-flex items-center gap-2" disabled={busy || !dirty || date > todayISODate()} onClick={save}><Save size={17} aria-hidden="true" />{t(busy ? 'common.saving' : 'students.attendance.save')}</button></div>}
          </>}
        </ResourceState>
      </div>}
    </ResourceState>
    <ConfirmDialog isOpen={!!leavingTo} onClose={() => setLeavingTo(null)} onConfirm={() => { const path = leavingTo; setMarks({}); setLeavingTo(null); navigate(path); }} variant="primary" title={t('students.attendance.leaveTitle')} description={t('students.attendance.leaveHint')} confirmLabel={t('students.attendance.discard')} />
  </div>;
}

function ShiftHistory({ shiftId }) {
  const { t } = useI18n();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const invalid = from && to && from > to;
  const load = useCallback(() => invalid ? Promise.resolve({ items: [] }) : api.listStudentAttendance({ shiftId, from, to }), [shiftId, from, to, invalid]);
  const resource = useStudentResource(load);
  const items = resource.data?.items || [];
  return <div className="card space-y-4 p-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('students.attendance.from')}><input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
      <Field label={t('students.attendance.to')}><input className="input" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></Field>
    </div>
    {invalid ? <Notice tone="error" title={t('students.attendance.invalidRange')} /> : <ResourceState resource={resource} empty={!items.length} emptyTitle={t('students.attendance.noHistory')}>
      <div className="max-h-[600px] overflow-auto"><table className="w-full text-left text-sm">
        <thead className="table-head"><tr>{['date', 'student', 'status', 'markedBy', 'note'].map((key) => <th key={key} className="px-3 py-3">{t('students.attendance.' + key)}</th>)}</tr></thead>
        <tbody className="divide-y divide-secondary-100">{items.map((item) => <tr key={item.id}><td className="whitespace-nowrap px-3 py-3">{formatMaybeDate(item.date, 'D MMM YYYY')}</td><td className="px-3 py-3">{item.studentName}</td><td className="px-3 py-3"><Badge variant={attendanceTone(item.status)}>{t('students.attendance.statuses.' + item.status)}</Badge></td><td className="px-3 py-3">{item.markedBy?.name || '—'}</td><td className="px-3 py-3">{item.note || '—'}</td></tr>)}</tbody>
      </table></div>
    </ResourceState>}
  </div>;
}
