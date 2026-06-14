import { useMemo, useState } from 'react';
import { ChevronRight, Wallet } from 'lucide-react';

import Notice from './Notice.jsx';
import PaymentMethodFields from './PaymentMethodFields.jsx';
import QuickPartySelector from './QuickPartySelector.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { todayISODate } from '../lib/datetime';
import { useI18n } from '../lib/i18n.jsx';
import {
  CUSTOM_EXPENSE_CATEGORY,
  resolveExpenseCategoryLabel,
  resolveExpenseCategoryPayload,
  useExpenseCategories,
} from '../hooks/useExpenseCategories.js';
import { buildPaymentPayload, requiresBankSelection } from '../lib/payments';
import { usePurchaseStore } from '../stores/purchases';

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
  const { businessId, canManageFeature, canViewFeature } = useAuth();
  const canManagePurchases = canManageFeature('purchases');
  const canViewParties = canViewFeature('parties');
  const { invalidate: invalidatePurchases, fetch: fetchPurchases } = usePurchaseStore();
  const { categories } = useExpenseCategories({ businessId, includeCustom: true });

  const [quickHeader, setQuickHeader] = useState(() => makeEmptyHeader());
  const [quickLines, setQuickLines] = useState(() => [makeEmptyLine()]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [partySelectorOpen, setPartySelectorOpen] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickStatus, setQuickStatus] = useState({ type: 'info', message: '' });

  const money = (value) => t('currency.formatted', {
    symbol: t('currency.symbol'),
    amount: Number(value || 0).toFixed(2),
  });

  const quickGrandTotal = useMemo(() => quickLines.reduce((sum, line) => {
    return sum + Math.max(Number(line.amount || 0), 0);
  }, 0), [quickLines]);

  const resetForm = () => {
    setQuickLines([makeEmptyLine()]);
    setQuickHeader(makeEmptyHeader());
    setSelectedParty(null);
    setPartySelectorOpen(false);
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

  const resolveLineLabel = (line) => resolveExpenseCategoryLabel(
    categories,
    line.categoryId,
    line.customCategory,
    t,
  );

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

    if (validLines.some((line) => line.categoryId === CUSTOM_EXPENSE_CATEGORY && !line.customCategory?.trim())) {
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
      const preparedLines = validLines.map((line) => ({
        line,
        categoryMeta: resolveExpenseCategoryPayload(
          categories,
          line.categoryId,
          line.customCategory,
          t,
        ),
      }));
      const primaryCategory = preparedLines[0]?.categoryMeta || null;

      const payload = {
        entryType: 'expense',
        partyId: selectedParty?.id || null,
        partyName: selectedParty?.name || resolveLineLabel(validLines[0]),
        expenseCategoryKey: primaryCategory?.categoryKey || null,
        expenseCategoryName: primaryCategory?.categoryName || null,
        expenseCategoryType: primaryCategory?.categoryType || null,
        purchaseDate: quickHeader.expenseDate,
        status: 'received',
        notes: '',
        amountReceived: quickGrandTotal,
        grandTotal: quickGrandTotal,
        subTotal: quickGrandTotal,
        taxTotal: 0,
        ...buildPaymentPayload(quickHeader),
        items: preparedLines.map(({ line, categoryMeta }) => {
          const amount = Number(line.amount || 0);
          const categoryLabel =
            categoryMeta.categoryName || resolveLineLabel(line);
          const description = line.notes
            ? `${categoryLabel} - ${line.notes}`
            : categoryLabel;

          return {
            itemType: 'expense',
            categoryKey: categoryMeta.categoryKey || null,
            categoryName: categoryMeta.categoryName || null,
            categoryType: categoryMeta.categoryType || null,
            categoryId: categoryMeta.categoryId ?? null,
            expenseCategoryKey: categoryMeta.categoryKey || null,
            expenseCategoryName: categoryMeta.categoryName || null,
            expenseCategoryType: categoryMeta.categoryType || null,
            expenseCategoryId: categoryMeta.categoryId ?? null,
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
      <form className="space-y-6" onSubmit={handleQuickExpenseSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[26px] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
            <label className="label">{t('purchases.purchaseDate')}</label>
            <input
              type="date"
              className="input mt-2 w-full rounded-[18px]"
              value={quickHeader.expenseDate}
              onChange={(event) => setQuickHeader((prev) => ({ ...prev, expenseDate: event.target.value }))}
            />
          </div>

          {canViewParties ? (
            <div className="rounded-[26px] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
              <label className="label">{t('quickExpense.linkPartyOptional')}</label>
              <button
                type="button"
                onClick={() => setPartySelectorOpen(true)}
                className="mt-2 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-primary-200 hover:bg-primary-50/40 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {selectedParty?.name || t('quickExpense.selectPayee')}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {selectedParty?.phone || t('quickExpense.payeeHelper')}
                  </p>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </button>
              {selectedParty ? (
                <button
                  type="button"
                  className="btn-ghost mt-3 w-full justify-center rounded-[18px] sm:w-auto"
                  onClick={() => setSelectedParty(null)}
                >
                  {t('common.clear')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          {quickLines.map((line, index) => {
            const catMeta = resolveCatMeta(line);
            const CatIcon = catMeta?.icon || Wallet;
            const lineAmount = Number(line.amount || 0);
            const isCustom = line.categoryId === CUSTOM_EXPENSE_CATEGORY;

            return (
              <div
                key={line._key}
                className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/50 md:p-6"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm ${catMeta ? catMeta.iconWrap : 'bg-slate-100 text-slate-400'}`}>
                    <CatIcon size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {t('quickExpense.lineLabel', { number: index + 1 })}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{t('quickEntry.categoryHelper')}</p>
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const isActive = line.categoryId === category.id;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => updateLine(line._key, 'categoryId', category.id)}
                        className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 transition ${isActive ? `border-2 ${category.activeColor}` : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700'}`}
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? category.iconWrap : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                          <Icon size={16} />
                        </span>
                        <span className="text-center text-xs font-semibold leading-tight text-slate-600 dark:text-slate-300">
                          {category.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isCustom ? (
                  <div className="mb-4">
                    <label className="label">{t('quickExpense.categoryName')}</label>
                    <input
                      className="input mt-2 rounded-[18px]"
                      type="text"
                      placeholder={t('quickExpense.categoryNamePlaceholder')}
                      value={line.customCategory || ''}
                      onChange={(event) => updateLine(line._key, 'customCategory', event.target.value)}
                    />
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
                    <label className="label">{t('quickEntry.amount')}</label>
                    <input
                      className="input mt-2 rounded-[18px] text-lg font-semibold"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={line.amount}
                      onChange={(event) => updateLine(line._key, 'amount', event.target.value)}
                    />
                  </div>

                  <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
                    <label className="label">{t('common.notes')}</label>
                    <input
                      className="input mt-2 rounded-[18px]"
                      type="text"
                      placeholder={t('quickEntry.notesPlaceholder')}
                      value={line.notes}
                      onChange={(event) => updateLine(line._key, 'notes', event.target.value)}
                    />
                  </div>
                </div>

                {lineAmount > 0 && catMeta && line.categoryId ? (
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${catMeta.badge}`}>
                      <CatIcon size={10} />
                      {resolveLineLabel(line)}
                    </span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">{money(lineAmount)}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {quickGrandTotal > 0 ? (
          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
              {t('purchases.grandTotal')}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{money(quickGrandTotal)}</p>
              <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">{t('quickEntry.liveTotal')}</p>
            </div>
          </div>
        ) : null}

        <div className="rounded-[28px] border border-slate-200/80 bg-slate-50 p-5 dark:border-slate-800/70 dark:bg-slate-900/50">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
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

        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-2 border-t border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95 md:-mx-5 md:-mb-5 md:px-5 md:py-5">
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
        </div>
      </form>

      <QuickPartySelector
        isOpen={partySelectorOpen}
        onClose={() => setPartySelectorOpen(false)}
        onSelect={setSelectedParty}
        selectedParty={selectedParty}
        type="supplier"
        title={t('quickExpense.selectPayeeTitle')}
      />
    </>
  );
}
