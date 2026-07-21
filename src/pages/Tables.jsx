import { useEffect, useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { Coffee, Users, Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';

const emptyForm = {
  name: '',
  capacity: '',
  status: 'vacant',
  isActive: true,
  categoryId: '',
};

function getTableItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

export default function Tables() {
  const { t } = useI18n();
  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [statusFilter, setStatusFilter] = useState(''); // '', 'vacant', 'occupied'
  const [floorFilter, setFloorFilter] = useState('all');

  const [editingId, setEditingId] = useState(null);
  const [deleteTable, setDeleteTable] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadFloors = async () => {
    try {
      const data = await api.listCategories({ type: 'table', limit: 100 });
      setFloors(data?.items || []);
    } catch (err) {
      console.error('Failed to load floors', err);
    }
  };

  useEffect(() => {
    loadFloors();
  }, []);

  useEffect(() => {
    if (status.type !== 'success' && status.type !== 'error') return;
    const timer = setTimeout(() => setStatus({ type: 'info', message: '' }), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  const loadTables = async () => {
    setLoading(true);
    try {
      const params = {
        status: statusFilter || undefined,
        limit: 100,
      };
      if (floorFilter !== 'all' && floorFilter !== 'unassigned') {
        params.categoryId = floorFilter;
      }
      const data = await api.getTables(params);
      let items = getTableItems(data);
      if (floorFilter === 'unassigned') {
        items = items.filter(t => !t.categoryId && !t.category);
      }
      setTables(items);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, [statusFilter, floorFilter]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const finalValue = type === 'checkbox' ? checked : value;
    setForm((prev) => ({ ...prev, [name]: finalValue }));
  };

  const handleEdit = (table) => {
    setEditingId(table.id);
    setForm({
      name: table.name || '',
      capacity: table.capacity || '',
      status: table.status || 'vacant',
      isActive: table.isActive !== false,
      categoryId: table.categoryId || table.category?.id || '',
    });
    setStatus({ type: 'info', message: '' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setStatus({ type: 'info', message: '' });
  };

  const handleDelete = async () => {
    if (!deleteTable) return;
    setDeleteSubmitting(true);
    try {
      await api.deleteTable(deleteTable.id);
      setStatus({ type: 'success', message: t('tables.messages.deleted') || 'Table deleted successfully.' });
      await loadTables();
    } catch (err) {
      setStatus({ 
        type: 'error', 
        message: err.status === 400 
          ? (t('tables.messages.deleteError') || 'Cannot delete table. Make sure it has no active sales or unpaid orders.')
          : err.message 
      });
    } finally {
      setDeleteSubmitting(false);
      setDeleteTable(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: '' });

    const payload = {
      name: form.name,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      status: form.status,
      isActive: form.isActive,
      categoryId: form.categoryId || null,
    };

    try {
      if (editingId) {
        await api.updateTable(editingId, payload);
        setStatus({ type: 'success', message: t('tables.messages.updated') || 'Table updated successfully.' });
      } else {
        await api.createTable(payload);
        setStatus({ type: 'success', message: t('tables.messages.created') || 'Table created successfully.' });
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadTables();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (table) => {
    const nextStatus = table.status === 'occupied' ? 'vacant' : 'occupied';
    try {
      await api.updateTable(table.id, { status: nextStatus });
      setTables((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, status: nextStatus } : t))
      );
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleToggleActive = async (table) => {
    const nextActive = !table.isActive;
    try {
      await api.updateTable(table.id, { isActive: nextActive });
      setTables((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, isActive: nextActive } : t))
      );
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = tables.length;
    const vacant = tables.filter((t) => t.status === 'vacant').length;
    const occupied = tables.filter((t) => t.status === 'occupied').length;
    return { total, vacant, occupied };
  }, [tables]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('tables.title') || 'Table Management'}
        subtitle={t('tables.subtitle') || 'Manage seating layout, occupancy status, and table capacities.'}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card bg-white p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Tables</p>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-200">{stats.total}</p>
          </div>
          <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Coffee size={20} />
          </div>
        </div>

        <div className="card bg-white p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vacant Tables</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.vacant}</p>
          </div>
          <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        <div className="card bg-white p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Occupied Tables</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.occupied}</p>
          </div>
          <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="card sticky top-24 space-y-4 p-6 bg-white shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingId ? t('tables.editTable') || 'Edit Table' : t('tables.addTable') || 'Add Table'}
            </h3>

            {status.message && (
              <Notice 
                title={status.message} 
                tone={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : 'info'} 
              />
            )}

            <div className="space-y-4">
              <div>
                <label className="label">{t('tables.tableName') || 'Table Name'}</label>
                <input
                  required
                  name="name"
                  className="input mt-1"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Table 4, Balcony 2"
                />
              </div>

              <div>
                <label className="label">{t('tables.capacity') || 'Capacity'}</label>
                <input
                  type="number"
                  name="capacity"
                  min="1"
                  className="input mt-1"
                  value={form.capacity}
                  onChange={handleChange}
                  placeholder="e.g. 4"
                />
              </div>

              <div>
                <label className="label">{t('tables.status') || 'Status'}</label>
                <select
                  name="status"
                  className="input mt-1"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="vacant">{t('tables.vacant') || 'Vacant'}</option>
                  <option value="occupied">{t('tables.occupied') || 'Occupied'}</option>
                </select>
              </div>

              <div>
                <label className="label">Floor / Dining Area</label>
                <select
                  name="categoryId"
                  className="input mt-1"
                  value={form.categoryId || ''}
                  onChange={handleChange}
                >
                  <option value="">-- Unassigned / General --</option>
                  {floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {t('tables.active') || 'Active / Show in lists'}
                </span>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className="text-primary hover:opacity-85 transition"
                >
                  {form.isActive ? <ToggleRight size={38} className="text-[#9c5f22]" /> : <ToggleLeft size={38} className="text-slate-300" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={loading}
                type="submit"
                className="btn-primary flex-1 justify-center rounded-xl py-2.5 text-sm"
              >
                {loading ? t('common.saving') || 'Saving...' : t('tables.saveTable') || 'Save Table'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn-secondary rounded-xl py-2.5 text-sm"
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List Grid Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 bg-white/40 backdrop-blur p-4 rounded-2xl border border-slate-100 shadow-sm">
            {/* Floor Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap shrink-0">Floor:</span>
              <button
                type="button"
                onClick={() => setFloorFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  floorFilter === 'all'
                    ? 'bg-[#9c5f22] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                All Floors
              </button>
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => setFloorFilter(floor.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    floorFilter === floor.id
                      ? 'bg-[#9c5f22] text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {floor.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFloorFilter('unassigned')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  floorFilter === 'unassigned'
                    ? 'bg-[#9c5f22] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                Unassigned
              </button>
            </div>

            {/* Status Filters */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100/60 pt-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap shrink-0">Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  statusFilter === '' 
                    ? 'bg-[#9c5f22] text-white shadow-sm' 
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {t('tables.all') || 'All'}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('vacant')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  statusFilter === 'vacant' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {t('tables.vacant') || 'Vacant'}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('occupied')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  statusFilter === 'occupied' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {t('tables.occupied') || 'Occupied'}
              </button>
            </div>
          </div>

          {/* Seating layout grid */}
          {tables.length === 0 ? (
            <div className="card bg-white p-8 text-center text-slate-400">
              <Coffee size={40} className="mx-auto mb-3 opacity-30 text-slate-500" />
              <p className="text-sm font-semibold">{t('common.noData')}</p>
              <p className="text-xs mt-1 text-slate-400/80">No tables match your active search / status filters.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {tables.map((table) => {
                const isOccupied = table.status === 'occupied';
                return (
                  <div 
                    key={table.id} 
                    className={`card bg-white p-5 shadow-sm border transition relative flex flex-col justify-between h-40 ${
                      !table.isActive 
                        ? 'opacity-60 border-slate-100 bg-slate-50/50' 
                        : isOccupied 
                          ? 'border-amber-100 hover:shadow-md' 
                          : 'border-emerald-100 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-serif text-lg font-bold text-slate-800 dark:text-white truncate max-w-[130px]">
                            {table.name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {table.capacity ? (
                              <div className="flex items-center gap-1 text-xs text-slate-400 font-semibold">
                                <Users size={12} />
                                <span>{table.capacity} seats</span>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400">No capacity</p>
                            )}
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold border border-slate-200/40 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800">
                              {table.category?.name || floors.find(f => f.id === table.categoryId)?.name || 'No Floor'}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge clickable to toggle occupancy */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(table)}
                          title="Toggle occupancy status"
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                            isOccupied
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-400/20'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-400/20'
                          }`}
                        >
                          {isOccupied ? t('tables.occupied') || 'Occupied' : t('tables.vacant') || 'Vacant'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 border-t border-slate-50 pt-3">
                      {/* Active switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(table)}
                        title="Toggle active status"
                        className="text-slate-400 hover:text-slate-600 transition flex items-center gap-1.5"
                      >
                        {table.isActive !== false ? (
                          <>
                            <span className="h-2 w-2 rounded-full bg-[#9c5f22]" />
                            <span className="text-[10px] font-bold text-slate-500">Active</span>
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 rounded-full bg-slate-300" />
                            <span className="text-[10px] font-bold text-slate-400">Inactive</span>
                          </>
                        )}
                      </button>

                      {/* CRUD Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(table)}
                          className="p-1 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                          title={t('common.edit')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTable(table)}
                          className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition"
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTable)}
        onClose={() => setDeleteTable(null)}
        onConfirm={handleDelete}
        title={t('tables.addTable') ? 'Delete Table' : 'डेस्क/टेबल हटाउनुहोस्'}
        description={t('tables.deleteConfirm') || 'Are you sure you want to delete this table?'}
        confirming={deleteSubmitting}
      />
    </div>
  );
}
