import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import FlexibleDateInput from '@/components/form/FlexibleDateInput.jsx';
import Notice from '@/components/ui/Notice';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { todayISODate } from '@/lib/dates/datetime';
import { useBusinessSettings } from '@/lib/business/businessSettings.jsx';
import { useI18n } from '@/lib/i18n.jsx';
import { printElement } from '@/lib/print/print.js';
import {
  ID_TYPES,
  addDaysISO,
  asItems,
  displayDate,
  downloadCsv,
  errorMessage,
  firstDefined,
  landscapePrintPrepare,
  num,
  stayCheckIn,
  stayCheckOut,
  tx,
} from '@/lib/hotel/hotelUtils';

function idTypeLabel(t, value) {
  const match = ID_TYPES.find((type) => type.value === value);
  return match ? tx(t, match.key, match.label) : value || '';
}

function toRow(entry) {
  return {
    key: String(firstDefined(entry.id, entry.stayId, `${entry.guestName}-${entry.room}`) || Math.random()),
    guest: String(firstDefined(entry.guestName, entry.name, entry.party?.name, entry.guest?.name) || ''),
    nationality: String(firstDefined(entry.nationality, entry.country) || ''),
    address: String(firstDefined(entry.address, entry.guestAddress, entry.party?.address) || ''),
    phone: String(firstDefined(entry.guestPhone, entry.phone, entry.party?.phone) || ''),
    idType: String(firstDefined(entry.idType) || ''),
    idNumber: String(firstDefined(entry.idNumber) || ''),
    room: String(firstDefined(entry.roomName, entry.room?.name, entry.room, entry.roomNumber) || ''),
    checkIn: stayCheckIn(entry),
    checkOut: stayCheckOut(entry),
    adults: num(entry.adults),
    children: num(entry.children),
  };
}

/**
 * Guest register: printable (A4 landscape) + CSV. Importable from Reports.
 * Pass `from` / `to` to control the range from outside and hide the pickers.
 * Only mount where the hotel module is enabled (it calls /api/hotel/*).
 */
export default function GuestRegisterPanel({ from: fromProp, to: toProp, className = '' }) {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const { settings } = useBusinessSettings();
  const L = (key, fallback) => tx(t, key, fallback);
  const controlled = Boolean(fromProp && toProp);

  const [from, setFrom] = useState(() => fromProp || addDaysISO(todayISODate(), -6));
  const [to, setTo] = useState(() => toProp || todayISODate());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sheetRef = useRef(null);

  const rangeFrom = controlled ? fromProp : from;
  const rangeTo = controlled ? toProp : to;

  const load = useCallback(async () => {
    if (!businessId || !rangeFrom || !rangeTo) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api.getHotelGuestRegister({ from: rangeFrom, to: rangeTo });
      setRows(asItems(payload, ['entries', 'guests', 'register', 'stays']).map(toRow));
    } catch (err) {
      setRows([]);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId, rangeFrom, rangeTo]);

  useEffect(() => {
    load();
  }, [load]);

  const businessName = firstDefined(settings?.companyName, settings?.businessName) || '';
  const columns = [
      L('hotel.register.sn', 'S.N.'),
      L('hotel.booking.guestName', 'Guest name'),
      L('hotel.register.nationality', 'Nationality'),
      L('hotel.register.address', 'Address'),
      L('hotel.booking.guestPhone', 'Phone'),
      L('hotel.booking.idType', 'ID type'),
      L('hotel.booking.idNumber', 'ID number'),
      L('hotel.board.room', 'Room'),
      L('hotel.booking.checkIn', 'Check-in'),
      L('hotel.booking.checkOut', 'Check-out'),
      L('hotel.register.guests', 'Guests'),
    ];

  const exportCsv = () => {
    downloadCsv(
      `guest-register-${rangeFrom}_${rangeTo}.csv`,
      columns,
      rows.map((row, index) => [
        index + 1,
        row.guest,
        row.nationality,
        row.address,
        row.phone,
        idTypeLabel(t, row.idType),
        row.idNumber,
        row.room,
        displayDate(row.checkIn),
        displayDate(row.checkOut),
        row.adults + row.children,
      ]),
    );
  };

  return (
    <section className={`card space-y-4 bg-white p-4 md:p-5 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink">
            {L('hotel.register.title', 'Guest register')}
          </h3>
          <p className="text-xs text-secondary-500">
            {L('hotel.register.subtitle', 'Guests who stayed in the selected period.')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!controlled ? (
            <>
              <div className="w-44">
                <label className="label">{t('common.from')}</label>
                <FlexibleDateInput value={from} onChange={(value) => value && setFrom(value)} />
              </div>
              <div className="w-44">
                <label className="label">{t('common.to')}</label>
                <FlexibleDateInput value={to} onChange={(value) => value && setTo(value)} />
              </div>
            </>
          ) : null}
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <Download size={16} />
            CSV
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => printElement(sheetRef.current, { prepareClone: landscapePrintPrepare })}
            disabled={rows.length === 0}
          >
            <Printer size={16} />
            {t('common.print')}
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title={error} /> : null}

      <div className="overflow-x-auto rounded-2xl border border-secondary-200">
        <div ref={sheetRef} className="min-w-[960px] bg-white p-4 text-black">
          <div className="mb-3 flex items-end justify-between border-b border-black pb-2">
            <div>
              <h4 className="text-base font-bold">{businessName}</h4>
              <p className="text-xs font-semibold uppercase tracking-wide">
                {L('hotel.register.title', 'Guest register')}
              </p>
            </div>
            <p className="text-xs">
              {displayDate(rangeFrom)} – {displayDate(rangeTo)}
            </p>
          </div>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-black bg-gray-50 text-left">
                {columns.map((label) => (
                  <th key={label} className="px-1.5 py-1.5 font-bold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="py-6 text-center">{t('common.loading')}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="py-6 text-center">{t('common.noData')}</td></tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.key}-${index}`} className="border-b border-gray-300 align-top">
                    <td className="px-1.5 py-1.5">{index + 1}</td>
                    <td className="px-1.5 py-1.5 font-semibold">{row.guest}</td>
                    <td className="px-1.5 py-1.5">{row.nationality}</td>
                    <td className="px-1.5 py-1.5">{row.address}</td>
                    <td className="px-1.5 py-1.5">{row.phone}</td>
                    <td className="px-1.5 py-1.5">{idTypeLabel(t, row.idType)}</td>
                    <td className="px-1.5 py-1.5">{row.idNumber}</td>
                    <td className="px-1.5 py-1.5">{row.room}</td>
                    <td className="px-1.5 py-1.5 whitespace-nowrap">{displayDate(row.checkIn)}</td>
                    <td className="px-1.5 py-1.5 whitespace-nowrap">{displayDate(row.checkOut)}</td>
                    <td className="px-1.5 py-1.5">{row.adults + row.children || ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
