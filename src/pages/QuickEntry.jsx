import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, ChevronRight, CircleDollarSign, ReceiptText, Wallet } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Notice from '../components/Notice.jsx';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import NoteTextarea from '../components/NoteTextarea.jsx';
import QuickActionSuccessDialog from '../components/QuickActionSuccessDialog.jsx';
import QuickAmountPad, { evaluateQuickExpression } from '../components/QuickAmountPad.jsx';
import QuickPartySelector from '../components/QuickPartySelector.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { buildPaymentPayload, requiresBankSelection } from '../lib/payments';
import { todayISODate } from '../lib/datetime';
import {
  CUSTOM_EXPENSE_CATEGORY,
  resolveExpenseCategoryLabel,
  resolveExpenseCategoryPayload,
  useExpenseCategories,
} from '../hooks/useExpenseCategories.js';

const QUICK_ENTRY_TABS = [
  { key: 'sale', icon: CircleDollarSign },
  { key: 'service', icon: Briefcase },
  { key: 'purchase', icon: ReceiptText },
  { key: 'expense', icon: Wallet },
  { key: 'payment_in', icon: ArrowRight },
  { key: 'payment_out', icon: ArrowRight },
];

const emptyEntryForm = {
  category: '',
  customCategory: '',
  notes: '',
  paymentMethod: 'cash',
  bankId: '',
  paymentNote: '',
  txDate: todayISODate(),
};

export default function QuickEntry() {
  const { t } = useI18n();
  const { businessId, canManageFeature, canViewFeature } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('expense');
  const [expression, setExpression] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);
  const [partySelectorOpen, setPartySelectorOpen] = useState(false);
  const [form, setForm] = useState(emptyEntryForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(null);
  const canManagePurchases = canManageFeature('purchases');
  const canViewParties = canViewFeature('parties');
  const canManageParties = canManageFeature('parties');
  const { categories: expenseCategories } = useExpenseCategories({ businessId, includeCustom: true });

  const amount = useMemo(() => evaluateQuickExpression(expression), [expression]);
  const isInstantForm = ['expense', 'payment_in', 'payment_out'].includes(activeTab);
  const selectedCategoryLabel = resolveExpenseCategoryLabel(
    expenseCategories,
    form.category,
    form.customCategory,
    t,
  );
  const isCustomExpenseCategory = form.category === CUSTOM_EXPENSE_CATEGORY;

  const resetInstantForm = () => {
    setExpression('');
    setSelectedParty(null);
    setForm({
      ...emptyEntryForm,
      txDate: todayISODate(),
    });
    setStatus({ type: 'info', message: '' });
  };

  const recordLabel = activeTab === 'payment_in'
    ? t('quickEntry.recordPaymentIn')
    : activeTab === 'payment_out'
      ? t('quickEntry.recordPaymentOut')
      : t('quickEntry.recordExpense');

  const helperText = activeTab === 'expense'
    ? (selectedCategoryLabel || t('quickEntry.selectCategoryHint'))
    : selectedParty?.name || t('quickEntry.selectPartyHint');

  const launcherCard = (() => {
    if (activeTab === 'sale') {
      return {
        title: t('quickEntry.saleLauncherTitle'),
        description: t('quickEntry.saleLauncherDescription'),
        cta: t('quickEntry.openQuickPos'),
        to: '/app/pos',
      };
    }
    if (activeTab === 'service') {
      return {
        title: t('quickEntry.serviceLauncherTitle'),
        description: t('quickEntry.serviceLauncherDescription'),
        cta: t('quickEntry.openServiceOrder'),
        to: '/app/services?create=1',
      };
    }
    return {
      title: t('quickEntry.purchaseLauncherTitle'),
      description: t('quickEntry.purchaseLauncherDescription'),
      cta: t('quickEntry.openPurchaseEntry'),
      to: '/app/purchases?create=1&entry=purchase',
    };
  })();

  const submitInstantEntry = async () => {
    if (submitting) return;
    if (!businessId) {
      setStatus({ type: 'error', message: t('errors.businessIdRequired') });
      return;
    }
    if (activeTab === 'expense' && !canManagePurchases) {
      setStatus({ type: 'error', message: t('staffManagement.permissionError') });
      return;
    }
    if ((activeTab === 'payment_in' || activeTab === 'payment_out') && !canManageParties) {
      setStatus({ type: 'error', message: t('staffManagement.permissionError') });
      return;
    }
    if (amount <= 0) {
      setStatus({ type: 'error', message: t('quickEntry.amountRequired') });
      return;
    }
    if (activeTab === 'expense' && !form.category) {
      setStatus({ type: 'error', message: t('quickEntry.categoryRequired') });
      return;
    }
    if (activeTab === 'expense' && isCustomExpenseCategory && !form.customCategory.trim()) {
      setStatus({ type: 'error', message: t('quickExpense.customCategoryRequired') });
      return;
    }
    if ((activeTab === 'payment_in' || activeTab === 'payment_out') && !selectedParty?.id) {
      setStatus({ type: 'error', message: t('quickEntry.partyRequired') });
      return;
    }
    if (requiresBankSelection(form, amount)) {
      setStatus({ type: 'error', message: t('payments.bankRequired') });
      return;
    }

    try {
      setSubmitting(true);
      setStatus({ type: 'info', message: '' });

      if (activeTab === 'expense') {
        const categoryPayload = resolveExpenseCategoryPayload(
          expenseCategories,
          form.category,
          form.customCategory,
          t,
        );
        const categoryName =
          categoryPayload.categoryName ||
          selectedCategoryLabel ||
          t('purchases.expense');
        const notes = form.notes.trim();
        await api.createPurchase({
          entryType: 'expense',
          partyId: selectedParty?.id || null,
          partyName: selectedParty?.name || categoryName,
          expenseCategoryKey: categoryPayload.categoryKey || null,
          expenseCategoryName: categoryPayload.categoryName || null,
          expenseCategoryType: categoryPayload.categoryType || null,
          purchaseDate: form.txDate,
          status: 'received',
          notes,
          amountReceived: amount,
          subTotal: amount,
          taxTotal: 0,
          grandTotal: amount,
          ...(amount > 0 ? buildPaymentPayload(form) : { paymentMethod: 'cash' }),
          items: [
            {
              description: notes ? `${categoryName} - ${notes}` : categoryName,
              categoryKey: categoryPayload.categoryKey || null,
              categoryName: categoryPayload.categoryName || null,
              categoryType: categoryPayload.categoryType || null,
              categoryId: categoryPayload.categoryId ?? null,
              expenseCategoryKey: categoryPayload.categoryKey || null,
              expenseCategoryName: categoryPayload.categoryName || null,
              expenseCategoryType: categoryPayload.categoryType || null,
              expenseCategoryId: categoryPayload.categoryId ?? null,
              quantity: 1,
              unitType: 'primary',
              unitPrice: amount,
              taxRate: 0,
              lineTotal: amount,
              itemType: 'expense',
            },
          ],
        });

        setSuccessState({
          title: t('quickEntry.expenseRecordedTitle'),
          description: t('quickEntry.expenseRecordedDescription', {
            amount: t('currency.formatted', {
              symbol: t('currency.symbol'),
              amount: amount.toFixed(2),
            }),
            category: categoryName,
          }),
          actionPath: '/app/purchases',
          actionLabel: t('quickEntry.viewExpenses'),
        });
      } else {
        await api.createPartyTransaction({
          partyId: selectedParty.id,
          direction: activeTab === 'payment_in' ? 'receive' : 'give',
          amount,
          txDate: form.txDate,
          ...buildPaymentPayload(
            { paymentMethod: form.paymentMethod, bankId: form.bankId, paymentNote: form.paymentNote },
            { noteKey: 'note' },
          ),
        });

        setSuccessState({
          title: activeTab === 'payment_in'
            ? t('quickEntry.paymentInRecordedTitle')
            : t('quickEntry.paymentOutRecordedTitle'),
          description: t('quickEntry.paymentRecordedDescription', {
            amount: t('currency.formatted', {
              symbol: t('currency.symbol'),
              amount: amount.toFixed(2),
            }),
            party: selectedParty.name,
          }),
          actionPath: `/app/ledger?partyId=${selectedParty.id}`,
          actionLabel: t('quickEntry.viewLedger'),
        });
      }

      resetInstantForm();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('quickEntry.title')}
        subtitle={t('quickEntry.subtitle')}
        action={(
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary justify-center" to="/app/pos">
              {t('quickEntry.openQuickPos')}
            </Link>
            <Link className="btn-ghost justify-center" to="/app/banks">
              {t('nav.banks')}
            </Link>
          </div>
        )}
      />

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}

      <div className="rounded-[32px] border border-secondary-200/70 bg-white/90 p-4 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {QUICK_ENTRY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setStatus({ type: 'info', message: '' });
                }}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-secondary-50 text-secondary-800 hover:bg-secondary-100'
                }`}
              >
                <Icon size={16} className={tab.key === 'payment_out' ? 'rotate-90' : tab.key === 'payment_in' ? '-rotate-90' : ''} />
                {t(`quickEntry.tabs.${tab.key}`)}
              </button>
            );
          })}
        </div>
      </div>

      {!isInstantForm ? (
        <div className="rounded-[32px] border border-secondary-200/70 bg-white/90 p-6 shadow-sm">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('quickEntry.fastRoute')}</p>
            <h3 className="mt-3 font-serif text-3xl text-slate-900">{launcherCard.title}</h3>
            <p className="mt-3 text-base leading-7 text-slate-600">{launcherCard.description}</p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Link className="btn-primary h-14 justify-center rounded-[24px] text-base" to={launcherCard.to}>
              {launcherCard.cta}
            </Link>
            <Link className="btn-ghost h-14 justify-center rounded-[24px] text-base" to="/app/quick-entry">
              {t('quickEntry.backToQuickEntry')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-4">
            {activeTab === 'expense' ? (
              <div className="rounded-[32px] border border-secondary-200/70 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('quickEntry.category')}</p>
                    <p className="mt-1 text-sm text-slate-500">{t('quickEntry.categoryHelper')}</p>
                  </div>
                  <div className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                    {selectedCategoryLabel || t('quickEntry.chooseCategory')}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {expenseCategories.map((category) => {
                    const isActive = category.id === form.category;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setForm((previous) => ({
                          ...previous,
                          category: category.id,
                          customCategory: category.id === CUSTOM_EXPENSE_CATEGORY ? previous.customCategory : '',
                        }))}
                        className={`rounded-[20px] border px-3 py-3 text-left text-sm font-semibold transition ${
                          isActive
                            ? 'border-primary-300 bg-primary-50 text-primary-800 shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary-200 hover:bg-primary-50/40'
                        }`}
                      >
                        {category.label}
                      </button>
                    );
                  })}
                </div>
                {isCustomExpenseCategory ? (
                  <label className="mt-4 block">
                    <span className="label">{t('quickExpense.categoryName')}</span>
                    <input
                      className="input mt-2 h-12 rounded-[18px]"
                      type="text"
                      value={form.customCategory}
                      onChange={(event) => setForm((previous) => ({ ...previous, customCategory: event.target.value }))}
                      placeholder={t('quickExpense.categoryNamePlaceholder')}
                    />
                  </label>
                ) : null}
                {canViewParties ? (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => setPartySelectorOpen(true)}
                      className="w-full rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-left transition hover:border-primary-200 hover:bg-primary-50/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('quickExpense.linkPartyOptional')}</p>
                          <p className="mt-2 text-base font-semibold text-slate-900">
                            {selectedParty?.name || t('quickExpense.selectPayee')}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {selectedParty?.phone || t('quickExpense.payeeHelper')}
                          </p>
                        </div>
                        <ChevronRight className="text-slate-400" size={20} />
                      </div>
                    </button>
                    {selectedParty ? (
                      <button
                        type="button"
                        className="btn-ghost w-full justify-center rounded-[18px] sm:w-auto"
                        onClick={() => setSelectedParty(null)}
                      >
                        {t('common.clear')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPartySelectorOpen(true)}
                className="w-full rounded-[32px] border border-secondary-200/70 bg-white/90 p-4 text-left shadow-sm transition hover:border-primary-200 hover:bg-primary-50/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('quickEntry.party')}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{selectedParty?.name || t('quickEntry.selectParty')}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedParty?.phone || t('quickEntry.selectPartyHint')}</p>
                  </div>
                  <ChevronRight className="text-slate-400" size={20} />
                </div>
              </button>
            )}

            <div className="rounded-[32px] border border-secondary-200/70 bg-white/90 p-4 shadow-sm">
              <div className="grid gap-4">
                <label>
                  <span className="label">{t('common.date')}</span>
                  <input
                    className="input mt-2 h-12 rounded-[18px]"
                    type="date"
                    value={form.txDate}
                    onChange={(event) => setForm((previous) => ({ ...previous, txDate: event.target.value }))}
                  />
                </label>

                <PaymentMethodFields
                  value={form}
                  onChange={(patch) => setForm((previous) => ({ ...previous, ...patch }))}
                  showPaymentNote
                />

                <label>
                  <span className="label">{t('common.notes')}</span>
                  <NoteTextarea
                    className="input mt-2 min-h-[96px] resize-none rounded-[18px]"
                    value={form.notes}
                    onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                    placeholder={t('quickEntry.notesPlaceholder')}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-[36px] border border-secondary-200/70 bg-white/90 p-4 shadow-sm md:p-6">
            <QuickAmountPad
              expression={expression}
              onExpressionChange={setExpression}
              onConfirm={submitInstantEntry}
              submitLabel={submitting ? t('common.saving') : recordLabel}
              helperText={helperText}
            />
          </div>
        </div>
      )}

      <QuickPartySelector
        isOpen={partySelectorOpen}
        onClose={() => setPartySelectorOpen(false)}
        onSelect={setSelectedParty}
        selectedParty={selectedParty}
        type={activeTab === 'expense' ? 'supplier' : 'both'}
        title={activeTab === 'expense' ? t('quickExpense.selectPayeeTitle') : t('quickEntry.selectPartyTitle')}
      />

      <QuickActionSuccessDialog
        isOpen={Boolean(successState)}
        onClose={() => setSuccessState(null)}
        title={successState?.title || ''}
        description={successState?.description || ''}
        primaryAction={successState?.actionPath ? (
          <button
            type="button"
            className="btn-primary h-14 w-full justify-center rounded-[22px] text-base"
            onClick={() => {
              const target = successState.actionPath;
              setSuccessState(null);
              navigate(target);
            }}
          >
            {successState.actionLabel}
          </button>
        ) : null}
        secondaryAction={(
          <button
            type="button"
            className="btn-ghost h-14 w-full justify-center rounded-[22px] text-base"
            onClick={() => setSuccessState(null)}
          >
            {t('quickEntry.newEntry')}
          </button>
        )}
      />
    </div>
  );
}
