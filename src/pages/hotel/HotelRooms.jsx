import { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import { Dialog } from '@/components/ui/Dialog.tsx';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { asItems, errorMessage, money, num, tx } from '@/lib/hotel/hotelUtils';

const EMPTY_TYPE = {
  name: '',
  baseRate: '',
  maxAdults: '2',
  maxChildren: '0',
  taxRate: '0',
  description: '',
  isActive: true,
};

const EMPTY_ROOM = {
  name: '',
  roomTypeId: '',
  floor: '',
  rate: '',
  notes: '',
  isActive: true,
};

function typeToForm(type) {
  return {
    name: type.name || '',
    baseRate: type.baseRate ?? '',
    maxAdults: String(type.maxAdults ?? 2),
    maxChildren: String(type.maxChildren ?? 0),
    taxRate: String(type.taxRate ?? 0),
    description: type.description || '',
    isActive: type.isActive !== false,
  };
}

function roomToForm(room) {
  return {
    name: room.name || '',
    roomTypeId: String(room.roomTypeId || room.roomType?.id || ''),
    floor: room.floor ?? '',
    rate: room.rate ?? '',
    notes: room.notes || '',
    isActive: room.isActive !== false,
  };
}

export default function HotelRooms() {
  const { t } = useI18n();
  const { businessId, canManageFeature } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const canManage = canManageFeature('frontDesk');
  const L = (key, fallback, vars) => tx(t, key, fallback, vars);

  const [types, setTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [typeDialog, setTypeDialog] = useState(null); // { id?, form }
  const [roomDialog, setRoomDialog] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, item }
  const [deleting, setDeleting] = useState(false);
  const [inactiveOffer, setInactiveOffer] = useState(null); // { room, message }

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const [typePayload, roomPayload] = await Promise.all([
        api.getHotelRoomTypes({ limit: 200 }, { force: true }),
        api.getHotelRooms({ isActive: true, limit: 500 }, { force: true }),
      ]);
      setTypes(asItems(typePayload));
      setRooms(asItems(roomPayload));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const typeById = useMemo(() => {
    const map = new Map();
    types.forEach((type) => map.set(String(type.id), type));
    return map;
  }, [types]);

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        String(a.floor ?? '').localeCompare(String(b.floor ?? ''), undefined, { numeric: true })
        || String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true }),
      ),
    [rooms],
  );

  /* ---------------------------- room types ---------------------------- */

  const openTypeDialog = (type = null) => {
    setFormError('');
    setTypeDialog({ id: type?.id || null, form: type ? typeToForm(type) : { ...EMPTY_TYPE } });
  };

  const saveType = async (event) => {
    event.preventDefault();
    if (saving || !typeDialog) return;
    const { form, id } = typeDialog;
    if (!form.name.trim()) {
      setFormError(L('hotel.rooms.nameRequired', 'Name is required.'));
      return;
    }
    if (form.baseRate === '' || num(form.baseRate, -1) < 0) {
      setFormError(L('hotel.rooms.baseRateRequired', 'Enter a base rate of 0 or more.'));
      return;
    }
    const payload = {
      name: form.name.trim(),
      baseRate: num(form.baseRate),
      maxAdults: num(form.maxAdults, 1),
      maxChildren: num(form.maxChildren, 0),
      taxRate: num(form.taxRate, 0),
      description: form.description.trim(),
      isActive: Boolean(form.isActive),
    };
    setSaving(true);
    setFormError('');
    try {
      if (id) await api.updateHotelRoomType(id, payload);
      else await api.createHotelRoomType(payload);
      showSuccess(L('hotel.rooms.typeSaved', 'Room type saved.'));
      setTypeDialog(null);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ rooms ------------------------------- */

  const openRoomDialog = (room = null) => {
    setFormError('');
    const form = room ? roomToForm(room) : { ...EMPTY_ROOM };
    if (!room) {
      const firstActive = types.find((type) => type.isActive !== false);
      form.roomTypeId = firstActive ? String(firstActive.id) : '';
    }
    setRoomDialog({ id: room?.id || null, form });
  };

  const saveRoom = async (event) => {
    event.preventDefault();
    if (saving || !roomDialog) return;
    const { form, id } = roomDialog;
    if (!form.name.trim()) {
      setFormError(L('hotel.rooms.roomNameRequired', 'Room name or number is required.'));
      return;
    }
    if (!form.roomTypeId) {
      setFormError(L('hotel.rooms.roomTypeRequired', 'Choose a room type.'));
      return;
    }
    const payload = {
      name: form.name.trim(),
      roomTypeId: form.roomTypeId,
      floor: String(form.floor ?? '').trim(),
      rate: form.rate === '' ? null : num(form.rate),
      notes: form.notes.trim(),
      isActive: Boolean(form.isActive),
    };
    setSaving(true);
    setFormError('');
    try {
      if (id) await api.updateHotelRoom(id, payload);
      else await api.createHotelRoom(payload);
      showSuccess(L('hotel.rooms.roomSaved', 'Room saved.'));
      setRoomDialog(null);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ delete ------------------------------ */

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    const { kind, item } = deleteTarget;
    setDeleting(true);
    try {
      if (kind === 'type') await api.deleteHotelRoomType(item.id);
      else await api.deleteHotelRoom(item.id);
      showSuccess(L('hotel.rooms.deleted', 'Deleted.'));
      setDeleteTarget(null);
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setDeleteTarget(null);
      if (kind === 'room' && err?.status === 409) {
        setInactiveOffer({ room: item, message });
      } else {
        showError(message);
      }
    } finally {
      setDeleting(false);
    }
  };

  const setRoomInactive = async () => {
    if (!inactiveOffer || saving) return;
    setSaving(true);
    try {
      await api.updateHotelRoom(inactiveOffer.room.id, { isActive: false });
      showSuccess(L('hotel.rooms.setInactiveDone', 'Room set to inactive.'));
      setInactiveOffer(null);
      await load();
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ render ------------------------------ */

  const fieldRow = 'grid gap-3 sm:grid-cols-2';

  return (
    <div className="space-y-6">
      <PageHeader
        title={L('hotel.rooms.title', 'Rooms & room types')}
        subtitle={L('hotel.rooms.subtitle', 'Set up the room types and rooms guests can book.')}
        action={(
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        )}
      />

      {error ? <Notice tone="error" title={error} /> : null}
      {!canManage ? (
        <Notice
          tone="info"
          title={L('hotel.rooms.readOnly', 'You have view-only access to rooms.')}
        />
      ) : null}

      {/* Room types */}
      <section className="card space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold text-ink">
              {L('hotel.rooms.typesHeading', 'Room types')}
            </h3>
            <p className="text-xs text-secondary-500">
              {L('hotel.rooms.typesHint', 'Rate, tax and capacity shared by rooms of the same kind.')}
            </p>
          </div>
          {canManage ? (
            <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openTypeDialog()}>
              <Plus size={16} />
              {L('hotel.rooms.addType', 'Add room type')}
            </button>
          ) : null}
        </div>

        {loading && types.length === 0 ? (
          <p className="py-6 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : types.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-8 text-center text-sm text-secondary-500">
            {L('hotel.rooms.noTypes', 'No room types yet. Add one before creating rooms.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-secondary-100 text-[11px] uppercase tracking-wide text-secondary-400">
                  <th className="py-2 pr-3 font-semibold">{L('hotel.rooms.name', 'Name')}</th>
                  <th className="py-2 pr-3 font-semibold">{L('hotel.rooms.baseRate', 'Base rate / night')}</th>
                  <th className="py-2 pr-3 font-semibold">{L('hotel.rooms.capacity', 'Capacity')}</th>
                  <th className="py-2 pr-3 font-semibold">{L('hotel.rooms.taxRate', 'Tax %')}</th>
                  <th className="py-2 pr-3 font-semibold">{L('hotel.rooms.rooms', 'Rooms')}</th>
                  <th className="py-2 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {types.map((type) => {
                  const count = rooms.filter(
                    (room) => String(room.roomTypeId || room.roomType?.id) === String(type.id),
                  ).length;
                  return (
                    <tr key={type.id} className="border-b border-secondary-50 last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-ink">{type.name}</p>
                        {type.description ? (
                          <p className="max-w-xs truncate text-xs text-secondary-500">{type.description}</p>
                        ) : null}
                        {type.isActive === false ? (
                          <span className="mt-1 inline-block rounded-full border border-secondary-200 bg-secondary-100 px-2 py-0.5 text-[10px] font-bold text-secondary-500">
                            {L('hotel.rooms.inactive', 'Inactive')}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 font-semibold tabular-nums">{money(t, type.baseRate)}</td>
                      <td className="py-3 pr-3 text-secondary-600">
                        {num(type.maxAdults)} {L('hotel.rooms.adultsShort', 'adults')}
                        {num(type.maxChildren) > 0
                          ? ` + ${num(type.maxChildren)} ${L('hotel.rooms.childrenShort', 'children')}`
                          : ''}
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-secondary-600">{num(type.taxRate)}%</td>
                      <td className="py-3 pr-3 tabular-nums text-secondary-600">{count}</td>
                      <td className="py-3 text-right">
                        {canManage ? (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="rounded-lg p-2 text-secondary-500 hover:bg-secondary-100"
                              onClick={() => openTypeDialog(type)}
                              aria-label={t('common.edit')}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                              onClick={() => setDeleteTarget({ kind: 'type', item: type })}
                              aria-label={t('common.delete')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Rooms */}
      <section className="card space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold text-ink">
              {L('hotel.rooms.roomsHeading', 'Rooms')}
            </h3>
            <p className="text-xs text-secondary-500">
              {L('hotel.rooms.roomsHint', 'Leave the rate empty to use the room type base rate.')}
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={() => openRoomDialog()}
              disabled={types.length === 0}
            >
              <Plus size={16} />
              {L('hotel.rooms.addRoom', 'Add room')}
            </button>
          ) : null}
        </div>

        {loading && rooms.length === 0 ? (
          <p className="py-6 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : sortedRooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-secondary-200 py-8 text-center text-secondary-500">
            <BedDouble size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{L('hotel.rooms.noRooms', 'No rooms yet.')}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedRooms.map((room) => {
              const type = typeById.get(String(room.roomTypeId || room.roomType?.id));
              const typeName = room.roomTypeName || room.roomType?.name || type?.name || '—';
              const effectiveRate = room.rate ?? type?.baseRate ?? 0;
              return (
                <div key={room.id} className="rounded-2xl border border-secondary-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base font-bold text-ink">{room.name}</p>
                      <p className="truncate text-xs text-secondary-500">
                        {typeName}
                        {room.floor !== undefined && room.floor !== null && room.floor !== ''
                          ? ` · ${L('hotel.rooms.floor', 'Floor')} ${room.floor}`
                          : ''}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-secondary-500 hover:bg-secondary-100"
                          onClick={() => openRoomDialog(room)}
                          aria-label={t('common.edit')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          onClick={() => setDeleteTarget({ kind: 'room', item: room })}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold tabular-nums text-ink">
                    {money(t, effectiveRate)}
                    <span className="ml-1 text-xs font-normal text-secondary-500">
                      / {L('hotel.rooms.night', 'night')}
                    </span>
                  </p>
                  {room.notes ? <p className="mt-1 line-clamp-2 text-xs text-secondary-500">{room.notes}</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Room type dialog */}
      <Dialog
        isOpen={Boolean(typeDialog)}
        onClose={() => !saving && setTypeDialog(null)}
        title={
          typeDialog?.id
            ? L('hotel.rooms.editType', 'Edit room type')
            : L('hotel.rooms.addType', 'Add room type')
        }
        size="lg"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setTypeDialog(null)} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="hotel-room-type-form" className="btn-primary" disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </>
        )}
      >
        {typeDialog ? (
          <form id="hotel-room-type-form" onSubmit={saveType} className="space-y-4">
            {formError ? <Notice tone="error" title={formError} /> : null}
            <div>
              <label className="label">{L('hotel.rooms.name', 'Name')}</label>
              <input
                className="input"
                value={typeDialog.form.name}
                onChange={(e) => setTypeDialog((d) => ({ ...d, form: { ...d.form, name: e.target.value } }))}
                placeholder={L('hotel.rooms.typeNamePlaceholder', 'Deluxe double')}
                autoFocus
              />
            </div>
            <div className={fieldRow}>
              <div>
                <label className="label">{L('hotel.rooms.baseRate', 'Base rate / night')}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input"
                  value={typeDialog.form.baseRate}
                  onChange={(e) => setTypeDialog((d) => ({ ...d, form: { ...d.form, baseRate: e.target.value } }))}
                />
              </div>
              <div>
                <label className="label">{L('hotel.rooms.taxRate', 'Tax %')}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input"
                  value={typeDialog.form.taxRate}
                  onChange={(e) => setTypeDialog((d) => ({ ...d, form: { ...d.form, taxRate: e.target.value } }))}
                />
              </div>
              <div>
                <label className="label">{L('hotel.rooms.maxAdults', 'Max adults')}</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={typeDialog.form.maxAdults}
                  onChange={(e) => setTypeDialog((d) => ({ ...d, form: { ...d.form, maxAdults: e.target.value } }))}
                />
              </div>
              <div>
                <label className="label">{L('hotel.rooms.maxChildren', 'Max children')}</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={typeDialog.form.maxChildren}
                  onChange={(e) => setTypeDialog((d) => ({ ...d, form: { ...d.form, maxChildren: e.target.value } }))}
                />
              </div>
            </div>
            <div>
              <label className="label">{L('hotel.rooms.description', 'Description')}</label>
              <textarea
                className="input min-h-[72px]"
                value={typeDialog.form.description}
                onChange={(e) => setTypeDialog((d) => ({ ...d, form: { ...d.form, description: e.target.value } }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={typeDialog.form.isActive}
                onChange={(e) => setTypeDialog((d) => ({ ...d, form: { ...d.form, isActive: e.target.checked } }))}
              />
              {L('hotel.rooms.active', 'Active')}
            </label>
          </form>
        ) : null}
      </Dialog>

      {/* Room dialog */}
      <Dialog
        isOpen={Boolean(roomDialog)}
        onClose={() => !saving && setRoomDialog(null)}
        title={roomDialog?.id ? L('hotel.rooms.editRoom', 'Edit room') : L('hotel.rooms.addRoom', 'Add room')}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setRoomDialog(null)} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="hotel-room-form" className="btn-primary" disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </>
        )}
      >
        {roomDialog ? (
          <form id="hotel-room-form" onSubmit={saveRoom} className="space-y-4">
            {formError ? <Notice tone="error" title={formError} /> : null}
            <div className={fieldRow}>
              <div>
                <label className="label">{L('hotel.rooms.roomName', 'Room name / number')}</label>
                <input
                  className="input"
                  value={roomDialog.form.name}
                  onChange={(e) => setRoomDialog((d) => ({ ...d, form: { ...d.form, name: e.target.value } }))}
                  placeholder="101"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">{L('hotel.rooms.roomType', 'Room type')}</label>
                <select
                  className="input"
                  value={roomDialog.form.roomTypeId}
                  onChange={(e) => setRoomDialog((d) => ({ ...d, form: { ...d.form, roomTypeId: e.target.value } }))}
                >
                  <option value="">{L('hotel.rooms.selectType', 'Select type')}</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                      {type.isActive === false ? ` (${L('hotel.rooms.inactive', 'Inactive').toLowerCase()})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{L('hotel.rooms.floor', 'Floor')}</label>
                <input
                  className="input"
                  value={roomDialog.form.floor}
                  onChange={(e) => setRoomDialog((d) => ({ ...d, form: { ...d.form, floor: e.target.value } }))}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="label">{L('hotel.rooms.rateOverride', 'Rate / night (optional)')}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input"
                  value={roomDialog.form.rate}
                  onChange={(e) => setRoomDialog((d) => ({ ...d, form: { ...d.form, rate: e.target.value } }))}
                  placeholder={L('hotel.rooms.rateFromType', 'Uses room type rate')}
                />
              </div>
            </div>
            <div>
              <label className="label">{L('hotel.rooms.notes', 'Notes')}</label>
              <textarea
                className="input min-h-[72px]"
                value={roomDialog.form.notes}
                onChange={(e) => setRoomDialog((d) => ({ ...d, form: { ...d.form, notes: e.target.value } }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={roomDialog.form.isActive}
                onChange={(e) => setRoomDialog((d) => ({ ...d, form: { ...d.form, isActive: e.target.checked } }))}
              />
              {L('hotel.rooms.active', 'Active')}
            </label>
          </form>
        ) : null}
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirming={deleting}
        title={
          deleteTarget?.kind === 'type'
            ? L('hotel.rooms.deleteType', 'Delete room type')
            : L('hotel.rooms.deleteRoom', 'Delete room')
        }
        description={L('hotel.rooms.deleteConfirm', 'Delete "{{name}}"? This cannot be undone.', {
          name: deleteTarget?.item?.name || '',
        })}
        confirmLabel={t('common.delete')}
      />

      {/* 409: room has stays -> offer inactive */}
      <Dialog
        isOpen={Boolean(inactiveOffer)}
        onClose={() => !saving && setInactiveOffer(null)}
        title={L('hotel.rooms.cannotDelete', 'Room cannot be deleted')}
        size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setInactiveOffer(null)} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={setRoomInactive} disabled={saving}>
              {saving ? t('common.loading') : L('hotel.rooms.setInactive', 'Set inactive')}
            </button>
          </>
        )}
      >
        <div className="space-y-3 text-sm text-secondary-700">
          <p>{inactiveOffer?.message}</p>
          <p>
            {L(
              'hotel.rooms.setInactiveHint',
              'This room has stay history, so it cannot be deleted. Set it to inactive to hide it from the board and bookings.',
            )}
          </p>
        </div>
      </Dialog>
    </div>
  );
}
