import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Navigation, Search, MapPin, RefreshCw, Calendar, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Notice from '../components/Notice.jsx';
import RefreshButton from '../components/RefreshButton.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { useSnackbar } from '../lib/snackbar.jsx';
import { formatMaybeDate, formatMaybeDateTime } from '../lib/datetime';
import dayjs from '../lib/datetime';

export default function Attendance() {
  const { t } = useI18n();
  const { showError, showSuccess } = useSnackbar();
  const { user, role, businessId } = useAuth();
  
  // Punch Card States
  const [todayStatus, setTodayStatus] = useState(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [punching, setPunching] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [apiError, setApiError] = useState('');
  
  // History Filters & Logs States
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter inputs
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(() => dayjs().format('YYYY-MM-DD'));

  const isOwner = role === 'owner';

  // Current time for the punch clock display
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's status on businessId / mount
  const loadTodayStatus = useCallback(async (options = {}) => {
    if (!businessId) return;
    setTodayLoading(true);
    setApiError('');
    try {
      const response = await api.getTodayAttendance(options);
      setTodayStatus(response?.attendance || null);
    } catch (err) {
      console.error(err);
      setApiError(err.message || t('auth.errors.generic'));
    } finally {
      setTodayLoading(false);
    }
  }, [businessId, t]);

  // Fetch staff list for owners/managers
  const loadStaffList = useCallback(async (options = {}) => {
    if (!isOwner || !businessId) return;
    setStaffLoading(true);
    try {
      const response = await api.listStaff(options);
      const members = Array.isArray(response?.members) ? response.members : [];
      // Filter out members who have user records
      const validStaff = members.filter(m => m.user?.id);
      setStaffList(validStaff);
      
      // Auto-select the current user if they are in the list, or the first staff member
      if (validStaff.length > 0) {
        setSelectedStaffId((current) => {
          if (current) return current;
          const matchingMe = validStaff.find(m => m.user?.id === user?.id);
          return matchingMe ? matchingMe.user.id : validStaff[0].user.id;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStaffLoading(false);
    }
  }, [businessId, isOwner, user?.id]);

  // Fetch historical attendance records
  const loadHistoryLogs = useCallback(async (options = {}) => {
    if (!businessId) return;
    setHistoryLoading(true);
    try {
      const params = {
        from: dateFrom,
        to: dateTo,
      };

      if (isOwner && selectedStaffId) {
        params.businessUserId = selectedStaffId;
      }

      const response = await api.getAttendanceHistory(params, options);
      setHistory(response?.history || []);
    } catch (err) {
      console.error(err);
      showError(err.message || t('auth.errors.generic'));
    } finally {
      setHistoryLoading(false);
    }
  }, [businessId, dateFrom, dateTo, isOwner, selectedStaffId, showError, t]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);
    try {
      await Promise.all([
        loadTodayStatus({ force: true }),
        loadStaffList({ force: true }),
        loadHistoryLogs({ force: true }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadHistoryLogs, loadStaffList, loadTodayStatus, refreshing]);

  useEffect(() => {
    if (businessId) {
      loadTodayStatus();
      loadStaffList();
    }
  }, [businessId, loadStaffList, loadTodayStatus]);

  useEffect(() => {
    if (businessId && (!isOwner || selectedStaffId)) {
      loadHistoryLogs();
    }
  }, [businessId, dateFrom, dateTo, isOwner, loadHistoryLogs, selectedStaffId]);

  // Geolocation punch logic
  const handlePunch = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setPunching(true);
    setGpsError('');
    setApiError('');

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    const isPunchOut = todayStatus && !todayStatus.punchOutTime;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezoneOffset: new Date().getTimezoneOffset(),
        };

        try {
          if (isPunchOut) {
            await api.punchOut(coordinates);
            showSuccess(t('attendance.punchOutSuccess'));
          } else {
            await api.punchIn(coordinates);
            showSuccess(t('attendance.punchInSuccess'));
          }
          await loadTodayStatus();
          await loadHistoryLogs();
        } catch (err) {
          console.error(err);
          // Standard check for outside radius error status 400
          if (err.status === 400) {
            setApiError(t('attendance.outsideRadiusError'));
          } else {
            setApiError(err.message || t('auth.errors.generic'));
          }
        } finally {
          setPunching(false);
        }
      },
      (error) => {
        console.error(error);
        setPunching(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError(t('attendance.locationPermissionError'));
        } else {
          setGpsError(t('attendance.locationError'));
        }
      },
      options
    );
  };

  // Determine current punch card state and presentation details
  const punchState = useMemo(() => {
    if (!todayStatus) {
      return {
        label: t('attendance.punchIn'),
        action: 'in',
        statusText: t('attendance.absent'),
        colorClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        canPunch: true,
      };
    }
    if (todayStatus.punchInTime && !todayStatus.punchOutTime) {
      return {
        label: t('attendance.punchOut'),
        action: 'out',
        statusText: t('attendance.present'),
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800/40',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        canPunch: true,
      };
    }
    return {
      label: t('attendance.completedToday'),
      action: 'complete',
      statusText: t('attendance.completedToday'),
      colorClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-800/40',
      badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
      canPunch: false,
    };
  }, [todayStatus, t]);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <PageHeader
        title={t('attendance.title')}
        subtitle={t('attendance.subtitle')}
        action={
          <RefreshButton
            className="justify-center"
            refreshing={refreshing || todayLoading || historyLoading || staffLoading}
            onClick={handleRefresh}
          />
        }
      />

      {!businessId ? (
        <Notice title={t('staffManagement.businessRequired')} tone="warn" />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Punch Panel Card */}
        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60 flex flex-col justify-between h-full min-h-[400px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#9c5f22]/10 p-2.5 text-[#9c5f22]">
                  <Clock size={22} />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('attendance.title')}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formattedDate}</p>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${punchState.badgeColor}`}>
                {punchState.statusText}
              </span>
            </div>

            {/* Time Clock Visual */}
            <div className="mt-8 text-center">
              <p className="font-serif text-4xl tracking-widest font-bold text-slate-800 dark:text-white">
                {formattedTime}
              </p>
              <p className="mt-1 text-xs text-slate-400 uppercase tracking-widest">CURRENT TIME</p>
            </div>

            {/* Current punch state summaries */}
            <div className="mt-6 space-y-3">
              {todayStatus && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/60 dark:bg-slate-900/40 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">{t('attendance.punchInTimeLabel')}</span>
                    <span className="font-medium text-slate-800 dark:text-white">
                      {formatMaybeDateTime(todayStatus.punchInTime, 'hh:mm A')}
                    </span>
                  </div>
                  {todayStatus.punchOutTime && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">{t('attendance.punchOutTimeLabel')}</span>
                      <span className="font-medium text-slate-800 dark:text-white">
                        {formatMaybeDateTime(todayStatus.punchOutTime, 'hh:mm A')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {gpsError && (
                <Notice title={gpsError} tone="error" icon={AlertCircle} />
              )}

              {apiError && (
                <Notice title={apiError} tone="error" icon={AlertCircle} />
              )}
            </div>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={handlePunch}
              disabled={punching || !punchState.canPunch || !businessId}
              className={`w-full flex items-center justify-center gap-3 rounded-2xl py-4 font-semibold shadow-sm transition duration-200 ${
                punchState.action === 'in'
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : punchState.action === 'out'
                    ? 'bg-[#9c5f22] hover:bg-[#884e1b] text-white'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'
              }`}
            >
              {punching ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Navigation size={20} className={punchState.canPunch ? 'animate-pulse' : ''} />
                  {punchState.label}
                </>
              )}
            </button>
            <p className="mt-3 text-center text-2xs text-slate-400 flex items-center justify-center gap-1">
              <MapPin size={12} />
              Requires active location tracking to verify office premises.
            </p>
          </div>
        </div>

        {/* Info Card / Map Placeholder */}
        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60 flex flex-col justify-between h-full">
          <div>
            <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-4">Location Boundary Info</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Attendance records are bound to the office perimeter. Punch entries requested from locations outside the registered radius will not be accepted by the system.
            </p>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/60 dark:bg-slate-900/40 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="text-[#9c5f22] mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Active Tracking</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Device GPS coordinates will be captured locally and verified with the organization's backend server coordinates.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-500 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Office Boundary</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Please ensure you are within the designated boundary before checking in or out to avoid 400 location error alerts.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-400">Signed in as <strong className="text-slate-600 dark:text-slate-300">{user?.name || user?.email}</strong> ({role})</span>
          </div>
        </div>
      </div>

      {/* History Log Section */}
      <div className="card space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-slate-900 dark:text-white">{t('attendance.historyLogs')}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {isOwner ? 'Review and audit attendance logs for all team members.' : 'View your recent attendance check-in and checkout history.'}
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 dark:bg-slate-900/40 dark:border-slate-800/60">
          {isOwner && (
            <div>
              <label className="label" htmlFor="attendance-staff-filter">{t('attendance.filterStaff')}</label>
              <select
                id="attendance-staff-filter"
                className="input mt-1"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                disabled={staffLoading}
              >
                {staffLoading ? (
                  <option value="">{t('common.loading')}</option>
                ) : (
                  <>
                    <option value="">{t('attendance.selectStaff')}</option>
                    {staffList.map((member) => (
                      <option key={member.membershipId} value={member.user?.id}>
                        {member.user?.name || member.user?.email || '-'} ({member.jobTitle || member.category?.label || member.role})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="attendance-date-from">{t('attendance.dateFrom')}</label>
            <input
              id="attendance-date-from"
              type="date"
              className="input mt-1"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="attendance-date-to">{t('attendance.dateTo')}</label>
            <input
              id="attendance-date-to"
              type="date"
              className="input mt-1"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Data View */}
        {historyLoading ? (
          <div className="rounded-3xl border border-dashed border-slate-300/80 bg-slate-50/80 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            {t('attendance.loadingLogs')}
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300/80 bg-slate-50/80 p-10 text-center dark:border-slate-700 dark:bg-slate-900/50">
            <h3 className="font-serif text-xl text-slate-900 dark:text-white">{t('attendance.noLogs')}</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm text-slate-600 dark:text-slate-300">
              <thead className="text-left text-xs uppercase tracking-[0.14em] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  {isOwner && <th className="pb-3 pr-4">{t('attendance.staffName')}</th>}
                  <th className="pb-3 pr-4">{t('attendance.date')}</th>
                  <th className="pb-3 pr-4">{t('attendance.punchInTimeLabel')}</th>
                  <th className="pb-3 pr-4">{t('attendance.punchOutTimeLabel')}</th>
                  <th className="pb-3 pr-4">{t('attendance.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition duration-150">
                    {isOwner && (
                      <td className="py-4 pr-4 font-medium text-slate-900 dark:text-white">
                        <div className="space-y-0.5">
                          <p>{record.BusinessUser?.name || '-'}</p>
                          <p className="text-2xs text-slate-400">{record.BusinessUser?.email || '-'}</p>
                        </div>
                      </td>
                    )}
                    <td className="py-4 pr-4 font-medium">{formatMaybeDate(record.date, 'YYYY-MM-DD')}</td>
                    <td className="py-4 pr-4">
                      <div className="space-y-1">
                        <p>{formatMaybeDateTime(record.punchInTime, 'hh:mm A')}</p>
                        {record.isLatePunchIn && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-2xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-500/20">
                            Late
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-1">
                        <p>{formatMaybeDateTime(record.punchOutTime, 'hh:mm A')}</p>
                        {record.isEarlyPunchOut && (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-2xs font-medium text-rose-800 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-500/20">
                            Left Early
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-4 capitalize">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        record.status === 'present'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}>
                        {record.status === 'present' ? t('attendance.present') : t('attendance.absent')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
