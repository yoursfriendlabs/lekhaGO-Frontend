import { useEffect, useMemo, useState } from 'react';
import {
  Car,
  Tag,
  Utensils,
  UserRound,
  Wallet,
  Zap,
} from 'lucide-react';

import Notice from './Notice.jsx';
import PaymentMethodFields from './PaymentMethodFields.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { todayISODate } from '../lib/datetime';
import { useI18n } from '../lib/i18n.jsx';
import { buildPaymentPayload, requiresBankSelection } from '../lib/payments';
import { usePurchaseStore } from '../stores/purchases';

const CUSTOM_CATEGORY = '__custom__';

function makeEmptyLine() {
  return {
    _key: Math.random().toString(36).slice(2),
    categoryId: '',
    customCategory: '',
    amount: '',
    notes: '',
  };
}

function makeEmptyHeader() {
  return {
    expenseDate: todayISODate(),
    paymentMethod: 'cash',
    bankId: '',
    paymentNote: '',
  };
}

export default function QuickExpenseForm({ onClose, onSaved, listParams } = {}) {
  const { t } = useI18n();
  const { businessId, canManageFeature } = useAuth();
  const canManagePurchases = canManageFeature('purchases');
  const { invalidate: invalidatePurchases, fetch: fetchPurchases } = usePurchaseStore();

  const [quickHeader, setQuickHeader] = useState(() => makeEmptyHeader());
  const [quickLines, setQuickLines] = useState(() => [makeEmptyLine()]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSelectorOpen, setStaffSelectorOpen] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickStatus, setQuickStatus] = useState({ type: 'info', message: '' });
  const [managedCategories, setManagedCategories] = useState([]);

  const money = (value) => t('currency.formatted', {
    symbol: t('currency.symbol'),
    amount: Number(value || 0).toFixed(2),
  });

  useEffect(() => {
    let active = true;

    if (!businessId) {
      setManagedCategories([]);
      return undefined;
    }

    api.listCategories({ type: 'expense', limit: 100, offset: 0 })
      .then((response) => {
        if (!active) return;
        setManagedCategories(response.items || []);
      })
      .catch(() => {
        if (!active) return;
        setManagedCategories([]);
      });

    return () => {
      active = false;
    };
  }, [businessId]);

  const categories = useMemo(() => {
    const defaultCategories = [
      {
        id: 'food',
        label: t('quickExpense.categories.food'),
        icon: Utensils,
        activeColor: 'border-orange-400 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-900/20',
        iconWrap: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
      },
      {
        id: 'transport',
        label: t('quickEntry.categories.transport'),
        icon: Car,
        activeColor: 'border-blue-400 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-900/20',
        iconWrap: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      },
      {
        id: 'utilities',
        label: t('quickEntry.categories.utilities'),
        icon: Zap,
        activeColor: 'border-yellow-400 bg-yellow-50 dark:border-yellow-500/50 dark:bg-yellow-900/20',
        iconWrap: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
        badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
      },
    ];

    const managedOptions = managedCategories
      .filter((category) => category?.id && category?.name)
      .map((category) => ({
        id: `expense-category-${category.id}`,
        label: category.name,
        icon: Wallet,
        activeColor: 'border-teal-400 bg-teal-50 dark:border-teal-500/50 dark:bg-teal-900/20',
        iconWrap: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
        badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
      }));

    return [
      ...defaultCategories,
      ...managedOptions,
      {
        id: CUSTOM_CATEGORY,
        label: t('quickExpense.categories.custom'),
        icon: Tag,
        activeColor: 'border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-900/20',
        iconWrap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      },
    ];
  }, [managedCategories, t]);

  const quickGrandTotal = useMemo(() => quickLines.reduce((sum, line) => {
    return sum + Math.max(Number(line.amount || 0), 0);
  }, 0), [quickLines]);

  const resetForm = () => {
    setQuickLines([makeEmptyLine()]);
    setQuickHeader(makeEmptyHeader());
    setSelectedStaff(null);
    setStaffSelectorOpen(false);
    setQuickStatus({ type: 'info', message: '' });
  };

  const closeQuickExpense = () => {
    resetForm();
    onClose?.();
  };

  const updateLine = (key, field, value) => {
    setQuickLines((prev) => prev.map((line) => (
      line._key === key ? { ...line, [field]: value } : line
    )));
  };

  const resolveLineLabel = (line) => {
    if (line.categoryId === CUSTOM_CATEGORY) {
      return line.customCategory?.trim() || t('quickExpense.customExpense');
    }

    return categories.find((category) => category.id === line.categoryId)?.label || '';
  };

  const resolveCatMeta = (line) => {
    return categories.find((category) => category.id === line.categoryId) || null;
  };

  const handleQuickExpenseSubmit = async (event) => {
    event.preventDefault();

    if (!canManagePurchases) {
      setQuickStatus({ type: 'error', message: t('staffManagement.permissionError') });
      return;
    }

    if (!businessId) {
      setQuickStatus({ type: 'error', message: t('errors.businessIdRequired') });
      return;
    }

    if (!quickHeader.expenseDate) {
      setQuickStatus({ type: 'error', message: t('errors.purchaseDateRequired') });
      return;
    }

    const validLines = quickLines.filter((line) => line.categoryId && Number(line.amount || 0) > 0);

    if (!validLines.length) {
      setQuickStatus({ type: 'error', message: t('errors.expenseLineRequired') });
      return;
    }

    if (quickLines.some((line) => !line.categoryId && Number(line.amount || 0) > 0)) {
      setQuickStatus({ type: 'error', message: t('quickExpense.categoryRequired') });
      return;
    }

    if (validLines.some((line) => line.categoryId === CUSTOM_CATEGORY && !line.customCategory?.trim())) {
      setQuickStatus({ type: 'error', message: t('quickExpense.customCategoryRequired') });
      return;
    }

    if (requiresBankSelection(quickHeader, quickGrandTotal)) {
      setQuickStatus({ type: 'error', message: t('payments.bankRequired') });
      return;
    }

    try {
      setQuickSaving(true);
      setQuickStatus({ type: 'info', message: '' });

      const payload = {
        entryType: 'expense',
        partyId: selectedStaff?.id || null,
        partyName: selectedStaff?.name || resolveLineLabel(validLines[0]),
        purchaseDate: quickHeader.expenseDate,
        status: 'received',
        notes: '',
        amountReceived: quickGrandTotal,
        grandTotal: quickGrandTotal,
        subTotal: quickGrandTotal,
        taxTotal: 0,
        ...buildPaymentPayload(quickHeader),
        items: validLines.map((line) => {
          const amount = Number(line.amount || 0);
          const description = `${resolveLineLabel(line)}${line.notes ? ` - ${line.notes}` : ''}`;

          return {
            itemType: 'expense',
            description,
            quantity: 1,
            unitType: 'primary',
            unitPrice: amount,
            taxRate: 0,
            lineTotal: amount,
          };
        }),
      };

      await api.createPurchase(payload);
      resetForm();

      if (onSaved) {
        await onSaved();
      } else {
        invalidatePurchases(listParams);
        await fetchPurchases(listParams, true);
      }

      onClose?.();
    } catch (err) {
      setQuickStatus({ type: 'error', message: err.message || t('quickExpense.saveFailed') });
    } finally {
      setQuickSaving(false);
    }
  };

  return (
    <>
      <form className="space-y-5" onSubmit={handleQuickExpenseSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t('purchases.purchaseDate')}</label>
            <input
              type="date"
              className="input mt-1.5 w-full"
              value={quickHeader.expenseDate}
              onChange={(event) => setQuickHeader((prev) => ({ ...prev, expenseDate: event.target.value }))}
            />
          </div>


        </div>

        <div className="space-y-4">
          {quickLines.map((line, index) => {
          const catMeta = resolveCatMeta(line);
          const CatIcon = catMeta?.icon || Wallet;
          const lineAmount = Number(line.amount || 0);
          const isCustom = line.categoryId === CUSTOM_CATEGORY;

            return (
              <div
                key={line._key}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-xl text-sm ${catMeta ? catMeta.iconWrap : 'bg-slate-100 text-slate-400'}`}>
                    <CatIcon size={13} />
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {t('quickExpense.lineLabel', { number: index + 1 })}
                  </span>
                </div>

              <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {categories.map((category) => {
                  const Icon = category.icon;
                  const isActive = line.categoryId === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => updateLine(line._key, 'categoryId', category.id)}
                      className={`flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 transition ${isActive ? `border-2 ${category.activeColor}` : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700'}`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? category.iconWrap : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        <Icon size={14} />
                      </span>
                      <span className="text-center text-[10px] font-semibold leading-tight text-slate-600 dark:text-slate-300">
                        {category.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isCustom ? (
                <div className="mb-3">
                  <label className="label text-xs">{t('quickExpense.categoryName')}</label>
                  <input
                    className="input mt-1"
                    type="text"
                    placeholder={t('quickExpense.categoryNamePlaceholder')}
                    value={line.customCategory || ''}
                    onChange={(event) => updateLine(line._key, 'customCategory', event.target.value)}
                  />
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label text-xs">{t('quickEntry.amount')}</label>
                  <input
                    className="input mt-1"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={line.amount}
                    onChange={(event) => updateLine(line._key, 'amount', event.target.value)}
                  />
                </div>

                <div>
                  <label className="label text-xs">{t('common.notes')}</label>
                  <input
                    className="input mt-1"
                    type="text"
                    placeholder={t('quickEntry.notesPlaceholder')}
                    value={line.notes}
                    onChange={(event) => updateLine(line._key, 'notes', event.target.value)}
                  />
                </div>
              </div>

              {lineAmount > 0 && catMeta && line.categoryId ? (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/60">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${catMeta.badge}`}>
                    <CatIcon size={10} />
                    {resolveLineLabel(line)}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{money(lineAmount)}</span>
                </div>
              ) : null}
              </div>
            );
          })}
        </div>

        {quickGrandTotal > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            {t('purchases.grandTotal')}
          </p>
          <span className="text-xl font-bold text-slate-900 dark:text-white">{money(quickGrandTotal)}</span>
        </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {t('common.payment')}
        </p>
        <PaymentMethodFields
          value={{
            paymentMethod: quickHeader.paymentMethod,
            bankId: quickHeader.bankId,
            paymentNote: quickHeader.paymentNote,
          }}
          onChange={(patch) => setQuickHeader((prev) => ({ ...prev, ...patch }))}
        />
        </div>

        {quickStatus.message ? <Notice title={quickStatus.message} tone={quickStatus.type} /> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="btn-secondary w-full sm:w-auto"
          onClick={closeQuickExpense}
          disabled={quickSaving}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="btn-primary w-full sm:w-auto"
          disabled={quickSaving || quickGrandTotal <= 0}
        >
          {quickSaving ? t('common.saving') : t('quickEntry.recordExpense')}
        </button>
        </div>
      </form>


    </>
  );
}
