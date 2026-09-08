import { useEffect, useState } from 'react';
import {
  Banknote,
  ChevronDown,
  Printer,
  Sparkles,
  Truck,
  UserRound,
} from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import Notice from '../ui/Notice.jsx';
import PaymentMethodFields from '../form/PaymentMethodFields.jsx';
import NoteTextarea from '../form/NoteTextarea.jsx';
import FlexibleDateInput from '../form/FlexibleDateInput.jsx';

export default function QuickPosCheckoutDialog({
  isOpen,
  onClose,
  t,
  money,
  status,
  cart,
  cartCount,
  totals,
  checkoutForm,
  setCheckoutForm,
  onPaymentChange,
  bankAccountError,
  selectedParty,
  onSelectParty,
  isPaid,
  setIsPaid,
  showTables = false,
  vacantTables = [],
  isTablesEnabled = false,
  activeSessionOption,
  activeAttributes,
  onEditDelivery,
  suggestedInvoiceNo,
  quickAmountOptions,
  changeAmount,
  dueAmount,
  submitting,
  onSubmit,
  onEditItems,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const hasAdjustments =
    Number(checkoutForm.discount || 0) > 0 ||
    Number(checkoutForm.taxRate || 0) > 0 ||
    Boolean(checkoutForm.notes) ||
    Boolean(checkoutForm.invoiceNo);

  useEffect(() => {
    if (isOpen && hasAdjustments) setMoreOpen(true);
  }, [isOpen, hasAdjustments]);

  const applyTender = (value) => {
    const amount = Math.max(Number(value || 0), 0);
    setCheckoutForm((previous) => ({
      ...previous,
      amountReceived: amount.toFixed(2),
    }));
    setIsPaid(amount >= totals.grandTotal && totals.grandTotal > 0);
  };

  const handleAmountChange = (raw) => {
    setCheckoutForm((previous) => ({
      ...previous,
      amountReceived: raw,
    }));
    const amount = Number(raw || 0);
    setIsPaid(amount >= totals.grandTotal && totals.grandTotal > 0);
  };

  const collectLater = () => {
    setIsPaid(false);
    setCheckoutForm((previous) => ({
      ...previous,
      amountReceived: '0',
    }));
  };

  const primaryLabel = submitting
    ? t('common.saving')
    : isTablesEnabled
      ? t('quickPos.confirmOrder')
      : dueAmount > 0
        ? t('quickPos.saveDue', { amount: money(dueAmount) })
        : t('quickPos.charge', { amount: money(totals.grandTotal) });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={t('quickPos.confirmSale')}
      footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn-secondary h-12 w-full justify-center rounded-[18px] sm:w-auto sm:min-w-[10rem]"
            onClick={() => onSubmit('print')}
            disabled={!cart.length || submitting}
          >
            <Printer size={16} />
            {t('quickPos.saveAndPrint')}
          </button>
          <button
            type="button"
            className="btn-primary h-12 w-full justify-center rounded-[18px] text-base sm:flex-1"
            onClick={() => onSubmit('save')}
            disabled={!cart.length || submitting}
          >
            {primaryLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {status.message ? (
          <Notice title={status.message} tone={status.type} />
        ) : null}

        <div className="rounded-[24px] bg-primary px-4 py-4 text-white shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                {t('quickPos.toCollect')}
              </p>
              <p className="mt-1 font-serif text-3xl leading-none tracking-tight">
                {money(totals.grandTotal)}
              </p>
            </div>
            <p className="text-right text-xs font-medium text-white/70">
              {t('quickPos.itemCount', { count: cartCount })}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
            <span>
              {t('sales.subTotal')} {money(totals.subTotal)}
            </span>
            {totals.taxTotal > 0 ? (
              <span>
                {t('sales.taxTotal')} {money(totals.taxTotal)}
              </span>
            ) : null}
            {totals.discountTotal > 0 ? (
              <span>
                {t('quickPos.discount')} -{money(totals.discountTotal)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-[22px] border border-secondary-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {selectedParty?.name || t('quickPos.walkInCustomer')}
                </p>
                <p className="truncate text-xs text-secondary-500">
                  {selectedParty?.phone || t('quickPos.walkInHint')}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost h-9 rounded-xl px-3 text-xs font-bold"
              onClick={onSelectParty}
            >
              {selectedParty ? t('common.change') : t('quickPos.selectParty')}
            </button>
          </div>
        </div>

        {activeSessionOption === 'delivery' ? (
          <div className="rounded-[22px] border border-secondary-200 bg-mist px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-secondary-500">
                <Truck size={12} className="text-primary" />
                {t('quickPos.deliveryDetails')}
              </span>
              <button
                type="button"
                onClick={onEditDelivery}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                {t('common.edit')}
              </button>
            </div>
            <div className="mt-1.5 space-y-0.5 text-xs text-ink-light">
              <p>{activeAttributes?.customer_name || '—'}</p>
              <p>{activeAttributes?.customer_phone || '—'}</p>
              <p>{activeAttributes?.customer_address || '—'}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 rounded-[22px] border border-secondary-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-500">
              {t('quickPos.tender')}
            </p>
            <button
              type="button"
              onClick={collectLater}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                !isPaid && Number(checkoutForm.amountReceived || 0) === 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-mist text-secondary-600 hover:bg-secondary-100'
              }`}
            >
              {t('quickPos.collectLater')}
            </button>
          </div>

          {!selectedParty && !isPaid ? (
            <p className="text-xs font-medium text-amber-700">
              {t('quickPos.walkInDueHint')}
            </p>
          ) : null}

          <div className="flex items-center overflow-hidden rounded-2xl border border-secondary-200 bg-mist/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <span className="flex h-12 items-center gap-1.5 border-r border-secondary-200 bg-white px-3 text-xs font-bold text-secondary-500">
              <Banknote size={14} />
              {t('currency.symbol')}
            </span>
            <input
              className="h-12 w-full bg-transparent px-3 text-lg font-bold text-ink focus:outline-none"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={checkoutForm.amountReceived}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="0.00"
              aria-label={t('services.amountReceived')}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {quickAmountOptions.map((option) => {
              const selected =
                Math.abs(Number(checkoutForm.amountReceived || 0) - option.value) < 0.01;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => applyTender(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    selected
                      ? 'border-primary bg-primary text-white'
                      : 'border-secondary-200 bg-mist text-ink-light hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {changeAmount > 0 ? (
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-bold text-emerald-800">
              <span className="flex items-center gap-1.5">
                <Sparkles size={16} className="text-emerald-600" />
                {t('sales.changeToReturn')}
              </span>
              <span className="font-serif text-xl text-emerald-700">
                {money(changeAmount)}
              </span>
            </div>
          ) : dueAmount > 0 ? (
            <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm font-bold text-amber-800">
              <span>{t('sales.dueAmount')}</span>
              <span className="font-serif text-xl text-amber-700">
                {money(dueAmount)}
              </span>
            </div>
          ) : (
            <p className="text-xs font-semibold text-emerald-700">
              {t('quickPos.paymentSettled')}
            </p>
          )}

          {Number(checkoutForm.amountReceived || 0) > 0 || isPaid ? (
            <PaymentMethodFields
              variant="segmented"
              value={checkoutForm}
              onChange={onPaymentChange}
              bankAccountError={bankAccountError}
            />
          ) : null}
        </div>

        <div className="rounded-[22px] border border-secondary-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-500">
              {t('quickPos.billingItems', { count: cart.length })}
            </p>
            <button
              type="button"
              className="text-xs font-bold text-primary hover:underline"
              onClick={onEditItems}
            >
              {t('quickPos.addItems')}
            </button>
          </div>
          <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
            {cart.map((item) => (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <p className="min-w-0 truncate text-ink">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-secondary-500"> × {item.quantity}</span>
                </p>
                <span className="shrink-0 font-semibold text-ink">
                  {money(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-[18px] border border-secondary-200 bg-mist px-3 py-2.5 text-left text-sm font-semibold text-ink-light"
        >
          <span>{t('quickPos.moreDetails')}</span>
          <ChevronDown
            size={18}
            className={`transition ${moreOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {moreOpen ? (
          <div className="space-y-3 rounded-[22px] border border-secondary-200 bg-white p-3">
            <div className={`grid gap-2 sm:grid-cols-2 ${showTables ? 'lg:grid-cols-3' : ''}`}>
              <label className="rounded-xl border border-secondary-200 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-500">
                  {t('quickPos.invoiceNumber')}
                </span>
                <input
                  className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-semibold text-ink placeholder:text-secondary-400 focus:outline-none focus:ring-0"
                  value={checkoutForm.invoiceNo}
                  onChange={(event) =>
                    setCheckoutForm((previous) => ({
                      ...previous,
                      invoiceNo: event.target.value,
                    }))
                  }
                  placeholder={suggestedInvoiceNo || t('quickPos.autoInvoice')}
                />
              </label>
              <label className="rounded-xl border border-secondary-200 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-500">
                  {t('common.date')}
                </span>
                <FlexibleDateInput
                  className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-semibold text-ink focus:outline-none focus:ring-0"
                  value={checkoutForm.saleDate}
                  onChange={(event) =>
                    setCheckoutForm((previous) => ({
                      ...previous,
                      saleDate: event.target.value,
                    }))
                  }
                />
              </label>
              {showTables ? (
                <label className="rounded-xl border border-secondary-200 px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-500">
                    {t('tables.tableName')}
                  </span>
                  <select
                    className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-semibold text-ink focus:outline-none focus:ring-0"
                    value={checkoutForm.tableId || ''}
                    onChange={(event) =>
                      setCheckoutForm((previous) => ({
                        ...previous,
                        tableId: event.target.value,
                      }))
                    }
                  >
                    <option value="">{t('quickPos.noTable')}</option>
                    {vacantTables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name}
                        {table.capacity ? ` (${table.capacity})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="rounded-xl border border-secondary-200 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-500">
                  {t('quickPos.discount')}
                </span>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-400">
                    {t('currency.symbol')}
                  </span>
                  <input
                    className="w-full border-0 bg-transparent py-1 pl-8 text-right text-sm font-bold text-ink focus:outline-none focus:ring-0"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={checkoutForm.discount || ''}
                    onChange={(event) =>
                      setCheckoutForm((previous) => ({
                        ...previous,
                        discount: event.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </label>
              <label className="rounded-xl border border-secondary-200 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-500">
                  {t('sales.tax')}
                </span>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-400">
                    %
                  </span>
                  <input
                    className="w-full border-0 bg-transparent py-1 pl-6 text-right text-sm font-bold text-ink focus:outline-none focus:ring-0"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={checkoutForm.taxRate || ''}
                    onChange={(event) =>
                      setCheckoutForm((previous) => ({
                        ...previous,
                        taxRate: event.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </label>
            </div>

            <NoteTextarea
              className="input min-h-[72px] resize-none rounded-xl text-sm"
              value={checkoutForm.notes}
              onChange={(event) =>
                setCheckoutForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
              placeholder={t('quickPos.notesPlaceholder')}
            />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
