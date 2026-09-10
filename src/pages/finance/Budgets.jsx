import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, Trash2, WalletCards } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Notice from '../../components/ui/Notice.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { Dialog } from '../../components/ui/Dialog.tsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import {
  resolveExpenseCategoryPayload,
  useExpenseCategories,
} from '../../hooks/useExpenseCategories.js';

const PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const emptyForm = {
  name: '',
  scope: 'category',
  categoryId: '',
  categoryKey: '',
  categoryName: '',
  amount: '',
  period: 'monthly',
  notes: '',
  isActive: true,
};

const money = (value) => `Rs ${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})}`;

const progressTone = (status) => ({
  over: 'bg-rose-500',
  warning: 'bg-amber-500',
  ok: 'bg-emerald-500',
}[status] || 'bg-primary');

const statusLabel = (status) => ({
  over: 'Over budget',
  warning: 'Nearly used',
  ok: 'On track',
}[status] || 'On track');

function categoryIdForBudget(categories, budget = {}) {
  const key = String(budget.categoryKey || '').toLowerCase();
  const name = String(budget.categoryName || '').toLowerCase();
  const matched = categories.find((category) => (
    String(category.backendKey || category.id || '').toLowerCase() === key
    || String(category.label || '').toLowerCase() === name
  ))?.id;
  return matched || (key ? `saved:${key}` : '');
}

function formFromBudget(budget, categories) {
  return {
    name: budget?.name || '',
    scope: budget?.scope || 'category',
    categoryId: categoryIdForBudget(categories, budget),
    categoryKey: budget?.categoryKey || '',
    categoryName: budget?.categoryName || '',
    amount: String(budget?.amount ?? ''),
    period: budget?.period || 'monthly',
    notes: budget?.notes || '',
    isActive: budget?.isActive !== false,
  };
}

export default function Budgets() {
  const { businessId, canManageFeature } = useAuth();
  const { t } = useI18n();
  const { categories, loading: categoriesLoading } = useExpenseCategories({
    businessId,
    includeCustom: false,
  });
  const canManageBudgets = canManageFeature('budgets');
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const totalRemaining = useMemo(() => (
    Number(summary?.totalRemaining || 0)
  ), [summary]);

  const loadBudgets = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const response = await api.listBudgets({ limit: 100, offset: 0 });
      setBudgets(response?.items || []);
      setSummary(response?.summary || null);
    } catch (error) {
      setBudgets([]);
      setSummary(null);
      setNotice({ tone: 'error', message: error?.message || 'Could not load budgets.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [businessId]);

  useEffect(() => {
    if (!notice || notice.tone === 'info') return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const openCreate = () => {
    if (!canManageBudgets) return;
    setEditing(null);
    const categoryId = categories[0]?.id || '';
    const categoryPayload = resolveExpenseCategoryPayload(categories, categoryId, '', t);
    setForm({
      ...emptyForm,
      categoryId,
      categoryKey: categoryPayload.categoryKey,
      categoryName: categoryPayload.categoryName,
    });
    setNotice(null);
    setDialogOpen(true);
  };

  const openEdit = async (budget) => {
    if (!canManageBudgets) return;
    setEditing(budget);
    setDialogOpen(true);
    setNotice(null);
    setForm(formFromBudget(budget, categories));
    try {
      const detail = await api.getBudget(budget.id);
      setEditing(detail);
      setForm(formFromBudget(detail, categories));
    } catch (error) {
      setNotice({ tone: 'error', message: error?.message || 'Could not load this budget.' });
    }
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const chooseCategory = (categoryId) => {
    const payload = resolveExpenseCategoryPayload(categories, categoryId, '', t);
    setForm((current) => ({
      ...current,
      categoryId,
      categoryKey: payload.categoryKey,
      categoryName: payload.categoryName,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canManageBudgets) return;

    const amount = Number(form.amount);
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setNotice({ tone: 'error', message: 'Enter a name and an amount greater than zero.' });
      return;
    }
    if (form.scope === 'category' && !form.categoryKey) {
      setNotice({ tone: 'error', message: 'Choose an expense category for this budget.' });
      return;
    }

    const payload = {
      name: form.name.trim(),
      scope: form.scope,
      amount,
      period: form.period,
      notes: form.notes.trim(),
      isActive: form.isActive,
      ...(form.scope === 'category'
        ? { categoryKey: form.categoryKey, categoryName: form.categoryName }
        : {}),
    };

    setSaving(true);
    try {
      if (editing?.id) await api.updateBudget(editing.id, payload);
      else await api.createBudget(payload);
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setNotice({ tone: 'success', message: editing?.id ? 'Budget updated.' : 'Budget created.' });
      await loadBudgets();
    } catch (error) {
      setNotice({ tone: 'error', message: error?.message || 'Could not save the budget.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleBudget = async (budget) => {
    if (!canManageBudgets) return;
    try {
      await api.updateBudget(budget.id, { isActive: !budget.isActive });
      setNotice({ tone: 'success', message: budget.isActive ? 'Budget paused.' : 'Budget resumed.' });
      await loadBudgets();
    } catch (error) {
      setNotice({ tone: 'error', message: error?.message || 'Could not update the budget.' });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteBudget(deleting.id);
      setDeleting(null);
      setNotice({ tone: 'success', message: 'Budget deleted.' });
      await loadBudgets();
    } catch (error) {
      setNotice({ tone: 'error', message: error?.message || 'Could not delete the budget.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Budgets"
        subtitle="Set spending limits and see early when a category is going over."
        action={canManageBudgets ? (
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={openCreate}>
            <Plus size={18} /> Add budget
          </button>
        ) : null}
      />

      {notice ? <Notice tone={notice.tone} title={notice.message} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Active budgets" value={summary?.budgetCount || 0} />
        <SummaryCard label="Budgeted" value={money(summary?.totalBudgeted)} />
        <SummaryCard label="Spent" value={money(summary?.totalSpent)} />
        <SummaryCard label="Left to spend" value={money(totalRemaining)} tone={totalRemaining < 0 ? 'danger' : 'normal'} />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-secondary-200 bg-surface p-8 text-center text-sm text-secondary-500">Loading budgets…</div>
      ) : budgets.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {budgets.map((budget) => {
            const percent = Math.max(0, Math.min(Number(budget.percentUsed || 0), 100));
            const inactive = budget.isActive === false;
            return (
              <article key={budget.id} className={`rounded-2xl border border-secondary-200 bg-surface p-4 shadow-sm sm:p-5 ${inactive ? 'opacity-65' : ''}`}>
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-ink">{budget.name}</h3>
                      <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-600">
                        {budget.scope === 'total' ? 'Overall spending' : budget.categoryName || 'Category'}
                      </span>
                      {!inactive ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${budget.status === 'over' ? 'bg-rose-100 text-rose-700' : budget.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{statusLabel(budget.status)}</span> : <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-600">Paused</span>}
                    </div>
                    <p className="mt-1 text-sm text-secondary-500">{budget.periodLabel || budget.period} · {budget.daysLeft ?? 0} days left</p>
                  </div>
                  {canManageBudgets ? (
                    <div className="flex shrink-0 items-start gap-1">
                      <IconButton label="Edit budget" onClick={() => openEdit(budget)}><Pencil size={16} /></IconButton>
                      <IconButton label={inactive ? 'Resume budget' : 'Pause budget'} onClick={() => toggleBudget(budget)}><Power size={16} /></IconButton>
                      <IconButton label="Delete budget" onClick={() => setDeleting(budget)} danger><Trash2 size={16} /></IconButton>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div><p className="text-xs font-medium uppercase tracking-wide text-secondary-500">Spent</p><p className="mt-1 text-xl font-semibold text-ink">{money(budget.spent)} <span className="text-sm font-medium text-secondary-500">of {money(budget.amount)}</span></p></div>
                  <p className={`text-sm font-semibold ${Number(budget.remaining) < 0 ? 'text-rose-600' : 'text-secondary-600'}`}>{Number(budget.remaining) < 0 ? `${money(Math.abs(budget.remaining))} over` : `${money(budget.remaining)} left`}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary-100"><div className={`h-full rounded-full transition-all ${progressTone(budget.status)}`} style={{ width: `${percent}%` }} /></div>
                <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-secondary-500"><span>{Number(budget.percentUsed || 0).toFixed(1)}% used</span>{budget.projectedStatus === 'over' ? <span className="font-medium text-amber-700">At this pace: {money(budget.projectedSpend)} projected</span> : <span>Projected: {money(budget.projectedSpend)}</span>}</div>
                {budget.notes ? <p className="mt-3 border-t border-secondary-100 pt-3 text-sm text-secondary-600">{budget.notes}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-secondary-300 bg-surface px-6 py-12 text-center">
          <WalletCards className="mx-auto h-9 w-9 text-primary" />
          <h3 className="mt-3 text-lg font-semibold text-ink">No budgets yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-secondary-600">Create an overall spending cap, or a separate cap for food, transport, bills, and any other expense category.</p>
          {canManageBudgets ? <button type="button" className="btn-primary mt-5" onClick={openCreate}>Create first budget</button> : null}
        </div>
      )}

      <Dialog isOpen={dialogOpen} onClose={closeDialog} title={editing?.id ? 'Edit budget' : 'New budget'} size="md" footer={<><button type="button" className="btn-secondary" onClick={closeDialog} disabled={saving}>Cancel</button><button type="submit" form="budget-form" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Create budget'}</button></>}>
        <form id="budget-form" className="space-y-4" onSubmit={submit}>
          <p className="text-sm text-secondary-600">A budget compares your recorded expenses with a spending limit for the current calendar period.</p>
          <label className="block"><span className="label">Budget name</span><input className="input mt-1" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Monthly food" required autoFocus /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Budget type</span><select className="input mt-1" value={form.scope} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value, categoryId: '', categoryKey: '', categoryName: '' }))}><option value="category">One expense category</option><option value="total">Overall spending</option></select></label>
            <label className="block"><span className="label">Period</span><select className="input mt-1" value={form.period} onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}>{PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}</select></label>
          </div>
          {form.scope === 'category' ? <label className="block"><span className="label">Expense category</span><select className="input mt-1" value={form.categoryId} onChange={(event) => chooseCategory(event.target.value)} disabled={categoriesLoading || !categories.length} required>{form.categoryId.startsWith('saved:') ? <option value={form.categoryId}>{form.categoryName || 'Current category'}</option> : <option value="">{categoriesLoading ? 'Loading categories…' : 'Choose a category'}</option>}{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select>{!categoriesLoading && !categories.length ? <span className="mt-1 block text-xs text-secondary-500">Add an expense category first, then return here.</span> : null}</label> : null}
          <label className="block"><span className="label">Spending limit</span><input className="input mt-1" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" required /></label>
          <label className="block"><span className="label">Note (optional)</span><textarea className="input mt-1 min-h-20" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="What this limit is for" /></label>
          {editing?.id ? <label className="flex items-center gap-2 text-sm font-medium text-ink"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Active budget</label> : null}
        </form>
      </Dialog>

      <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => !deleteBusy && setDeleting(null)} onConfirm={confirmDelete} confirming={deleteBusy} title="Delete budget?" description={`Delete “${deleting?.name || ''}”? This does not delete any expense records.`} confirmLabel="Delete budget" />
    </section>
  );
}

function SummaryCard({ label, value, tone = 'normal' }) {
  return <div className="rounded-2xl border border-secondary-200 bg-surface p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-secondary-500">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone === 'danger' ? 'text-rose-600' : 'text-ink'}`}>{value}</p></div>;
}

function IconButton({ label, onClick, children, danger = false }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`rounded-lg p-2 transition hover:bg-secondary-100 ${danger ? 'text-rose-600 hover:bg-rose-50' : 'text-secondary-600'}`}>{children}</button>;
}
