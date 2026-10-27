import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BedDouble, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice.jsx';
import PaymentMethodFields from '@/components/form/PaymentMethodFields.jsx';
import PartySearchCreateField from '@/components/parties/PartySearchCreateField.jsx';
import { api } from '@/lib/api';
import { normalizeStockWarnings, pickBackendMessage } from '@/lib/business/hospitality';
import { useSnackbar } from '@/lib/snackbar.jsx';
import {
  ITEM_STATUS,
  formatMoney,
  extractBill,
  normalizeBill,
  roundMoney,
  toNumber,
} from '@/lib/restaurant/model';
import { useTr } from '@/lib/restaurant/useTr';

const EPSILON = 0.005;
let rowSeed = 0;
const newRow = () => ({ id: `pay-${(rowSeed += 1)}`, paymentMethod: 'cash', bankId: '', amount: '' });

function formatWarning(warning) {
  if (typeof warning === 'string') return warning;
  const name = warning?.productName || warning?.name || warning?.ingredientName || '';
  const message = warning?.message || warning?.warning || '';
  return [name, message].filter(Boolean).join(': ') || 'Low stock';
}

/** Splits `total` into `parts` shares that sum exactly to `total`. */
function equalShares(total, parts) {
  const count = Math.max(1, Math.floor(parts));
  const base = Math.floor((roundMoney(total) / count) * 100) / 100;
  const shares = Array.from({ length: count }, () => base);
  shares[count - 1] = roundMoney(roundMoney(total) - base * (count - 1));
  return shares;
}

/**
 * Settle an order: adjustments, bill preview, single/mixed/split payments,
 * optional charge-to-room. Settle stays disabled until amounts add up.
 *
 * onSettled(result, { splitMode }) is called after a successful settle.
 */
export default function SettleDialog({ isOpen, order, onClose, onSettled }) {
  const tr = useTr();
  const { showInfo } = useSnackbar();

  const [discountMode, setDiscountMode] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [packagingCharge, setPackagingCharge] = useState('');
  const [party, setParty] = useState(null);

  const [splitMode, setSplitMode] = useState('none'); // none | equal | items
  const [splitCount, setSplitCount] = useState('2');
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  const [rows, setRows] = useState(() => [newRow()]);
  const [chargeToRoom, setChargeToRoom] = useState(false);

  const [preview, setPreview] = useState({ bill: null, loading: false, error: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const previewSeq = useRef(0);

  const billableItems = useMemo(
    () => (order?.items || []).filter((item) => item.status !== ITEM_STATUS.VOID),
    [order?.items],
  );
  const hasUnsentItems = billableItems.some((item) => item.status === ITEM_STATUS.PENDING);
  const canChargeToRoom = Boolean(order?.hotelStayId);

  /* Reset every time the dialog opens for an order. */
  useEffect(() => {
    if (!isOpen || !order) return;
    setDiscountMode(order.discountPercent > 0 && !(order.discountAmount > 0) ? 'percent' : 'amount');
    setDiscountValue(
      order.discountPercent > 0 && !(order.discountAmount > 0)
        ? String(order.discountPercent)
        : order.discountAmount > 0 ? String(order.discountAmount) : '',
    );
    const rate = order.serviceChargeRate ?? order.bill?.serviceChargeRate;
    setServiceCharge(rate == null || rate === '' ? '' : String(rate));
    setPackagingCharge(
      order.packagingCharge > 0
        ? String(order.packagingCharge)
        : order.hasBill && order.bill.packagingCharge > 0
          ? String(order.bill.packagingCharge)
          : '',
    );
    setParty(order.party?.id || order.party?.name ? order.party : null);
    setSplitMode('none');
    setSplitCount('2');
    setSelectedItemIds([]);
    setRows([newRow()]);
    setChargeToRoom(false);
    setSubmitError('');
    setSubmitting(false);
    setPreview({ bill: order.hasBill ? order.bill : null, loading: false, error: '' });
    // Only reset on open / order switch, not on every live refresh of the same order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, order?.id]);

  const buildAdjustments = useCallback(() => {
    const payload = {};
    const discount = toNumber(discountValue);
    if (discountMode === 'percent') {
      payload.discountPercent = Math.max(0, discount);
    } else {
      payload.discount = Math.max(0, discount);
    }
    // Rate (%), not a money amount — matches POST …/settle and bill-preview.
    if (serviceCharge === '' || serviceCharge == null) {
      payload.serviceChargeRate = null;
    } else {
      payload.serviceChargeRate = Math.max(0, toNumber(serviceCharge));
    }
    payload.packagingCharge = Math.max(0, toNumber(packagingCharge));
    return payload;
  }, [discountMode, discountValue, packagingCharge, serviceCharge]);

  /* Debounced server-side preview whenever an adjustment changes. */
  useEffect(() => {
    if (!isOpen || !order?.id) return undefined;
    if (splitMode === 'items' && selectedItemIds.length === 0) {
      setPreview({ bill: null, loading: false, error: '' });
      return undefined;
    }

    const seq = (previewSeq.current += 1);
    setPreview((previous) => ({ ...previous, loading: true, error: '' }));
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.previewRestaurantBill(order.id, buildAdjustments());
        if (seq !== previewSeq.current) return;
        setPreview({ bill: normalizeBill(extractBill(response)), loading: false, error: '' });
      } catch (error) {
        if (seq !== previewSeq.current) return;
        setPreview({ bill: null, loading: false, error: pickBackendMessage(error) });
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [buildAdjustments, isOpen, order?.id, selectedItemIds.length, splitMode]);

  const bill = preview.bill;
  const payable = bill ? roundMoney(bill.grandTotal) : 0;

  /* ---- payment rows --------------------------------------------------- */
  const equalCount = Math.max(2, Math.min(20, Math.floor(toNumber(splitCount, 2)) || 2));
  const mixed = splitMode !== 'equal' && rows.length > 1;

  // Equal split: one row per payer.
  useEffect(() => {
    if (splitMode !== 'equal') return;
    setRows((previous) => {
      if (previous.length === equalCount) return previous;
      if (previous.length > equalCount) return previous.slice(0, equalCount);
      return [...previous, ...Array.from({ length: equalCount - previous.length }, newRow)];
    });
  }, [equalCount, splitMode]);

  const shares = useMemo(
    () => (splitMode === 'equal' ? equalShares(payable, equalCount) : []),
    [equalCount, payable, splitMode],
  );

  const rowAmount = (row, index) => {
    if (splitMode === 'equal') return shares[index] ?? 0;
    if (mixed) return roundMoney(toNumber(row.amount));
    return payable;
  };

  const paidTotal = roundMoney(rows.reduce((sum, row, index) => sum + rowAmount(row, index), 0));
  const remaining = roundMoney(payable - paidTotal);
  const bankMissing = rows.some((row) => row.paymentMethod === 'bank' && !row.bankId);
  const negativeRow = rows.some((row, index) => rowAmount(row, index) < 0);
  const paymentsBalanced = Math.abs(remaining) < EPSILON;

  const canSettle = Boolean(bill)
    && !preview.loading
    && !preview.error
    && !submitting
    && (splitMode !== 'items' || selectedItemIds.length > 0)
    && (chargeToRoom
      || (paymentsBalanced && !bankMissing && !negativeRow));

  const updateRow = (id, patch) => {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  // Going from one row to two switches to "mixed": amounts become editable.
  const addMethod = () => {
    setRows((previous) => [...previous.map((row) => ({ ...row, amount: previous.length === 1 ? '' : row.amount })), newRow()]);
  };

  const removeRow = (id) => {
    setRows((previous) => (previous.length > 1 ? previous.filter((row) => row.id !== id) : previous));
  };

  const fillRemaining = (id) => {
    const other = rows.reduce((sum, row, index) => (row.id === id ? sum : sum + rowAmount(row, index)), 0);
    updateRow(id, { amount: String(Math.max(0, roundMoney(payable - other))) });
  };

  const changeSplitMode = (mode) => {
    setSplitMode(mode);
    setSubmitError('');
    setRows([newRow()]);
    if (mode !== 'items') setSelectedItemIds([]);
  };

  const toggleItem = (id) => {
    setSelectedItemIds((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]));
  };

  /* ---- submit -------------------------------------------------------- */
  const handleSettle = async () => {
    if (!canSettle) return;
    setSubmitting(true);
    setSubmitError('');

    const payload = { ...buildAdjustments() };
    if (party?.id) payload.partyId = party.id;

    if (splitMode === 'equal') {
      payload.split = {
        mode: 'equal',
        count: equalCount,
        parts: rows.map((row) => {
          const part = { paymentMethod: row.paymentMethod === 'bank' ? 'bank' : 'cash' };
          if (part.paymentMethod === 'bank' && row.bankId) part.bankId = row.bankId;
          if (party?.id) part.partyId = party.id;
          return part;
        }),
      };
    } else if (splitMode === 'items') {
      payload.split = {
        mode: 'items',
        parts: [{
          itemIds: selectedItemIds,
          paymentMethod: rows[0]?.paymentMethod === 'bank' ? 'bank' : 'cash',
          ...(rows[0]?.paymentMethod === 'bank' && rows[0]?.bankId ? { bankId: rows[0].bankId } : {}),
          ...(party?.id ? { partyId: party.id } : {}),
        }],
      };
    }

    if (chargeToRoom && canChargeToRoom) {
      payload.chargeToRoom = true;
      if (order.hotelStayId) payload.chargeToStayId = order.hotelStayId;
    } else if (splitMode === 'none') {
      if (rows.length === 1) {
        payload.paymentMethod = rows[0].paymentMethod === 'bank' ? 'bank' : 'cash';
        if (payload.paymentMethod === 'bank' && rows[0].bankId) payload.bankId = rows[0].bankId;
        payload.amountReceived = rowAmount(rows[0], 0);
      } else {
        payload.payments = rows.map((row, index) => {
          const entry = {
            paymentMethod: row.paymentMethod === 'bank' ? 'bank' : 'cash',
            amount: rowAmount(row, index),
          };
          if (entry.paymentMethod === 'bank' && row.bankId) entry.bankId = row.bankId;
          return entry;
        });
      }
    }

    try {
      const result = await api.settleRestaurantOrder(order.id, payload);
      const warnings = normalizeStockWarnings(result);
      if (warnings.length > 0) {
        showInfo({
          title: tr('restaurant.settle.stockWarnings', 'Stock warnings'),
          description: warnings.map(formatWarning).join('; '),
          duration: 9000,
        });
      }
      await onSettled?.(result, { splitMode });
    } catch (error) {
      // Backend wording (e.g. MIXED_PAYMENT_LOCKED) is shown exactly as sent.
      setSubmitError(pickBackendMessage(error, 'Unable to settle this order.'));
      setSubmitting(false);
    }
  };

  /* ---- render -------------------------------------------------------- */
  const summaryRow = (label, value, strong = false) => (
    <div className={`flex items-center justify-between ${strong ? 'text-base font-bold text-ink' : 'text-sm text-secondary-700'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  const segmentClass = (active) => `min-h-11 flex-1 rounded-2xl border px-3 text-sm font-semibold transition ${
    active
      ? 'border-primary bg-primary text-white'
      : 'border-secondary-200 bg-white text-ink-light hover:border-primary/40'
  }`;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title={tr('restaurant.settle.title', 'Settle order #{no}', { no: order?.orderNo || '' })}
      size="full"
      footer={(
        <>
          <div className="mr-auto hidden flex-col justify-center text-right sm:flex">
            <span className="text-[11px] uppercase tracking-wide text-secondary-500">
              {tr('restaurant.settle.toPay', 'To pay')}
            </span>
            <span className="text-lg font-bold text-ink">{bill ? formatMoney(payable) : '--'}</span>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            {tr('common.cancel', 'Cancel')}
          </button>
          <button type="button" className="btn-primary min-h-12 px-6" onClick={handleSettle} disabled={!canSettle}>
            {submitting
              ? tr('common.loading', 'Loading...')
              : chargeToRoom
                ? tr('restaurant.settle.chargeRoom', 'Charge to room')
                : tr('restaurant.settle.confirm', 'Settle {amount}', { amount: bill ? formatMoney(payable) : '' })}
          </button>
        </>
      )}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: adjustments + preview */}
        <div className="space-y-4">
          {submitError ? <Notice tone="error" title={submitError} /> : null}
          {preview.error ? <Notice tone="error" title={preview.error} /> : null}
          {hasUnsentItems ? (
            <Notice
              tone="warn"
              title={tr('restaurant.settle.unsent', 'Some items have not been sent to the kitchen.')}
            />
          ) : null}

          <div>
            <p className="label">{tr('restaurant.settle.customer', 'Customer (optional)')}</p>
            <PartySearchCreateField
              type="customer"
              selectedParty={party}
              onSelect={setParty}
              placeholder={tr('restaurant.settle.walkIn', 'Walk-in customer')}
              searchPlaceholder={tr('restaurant.settle.searchCustomer', 'Search customer')}
              entityLabel={tr('restaurant.settle.customerLabel', 'Customer')}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="label">{tr('restaurant.settle.discount', 'Discount')}</p>
              <div className="flex gap-2">
                <div className="flex shrink-0 gap-1">
                  <button type="button" className={`${segmentClass(discountMode === 'amount')} w-14 flex-none`} onClick={() => setDiscountMode('amount')}>
                    {tr('currency.symbol', 'Rs')}
                  </button>
                  <button type="button" className={`${segmentClass(discountMode === 'percent')} w-14 flex-none`} onClick={() => setDiscountMode('percent')}>
                    %
                  </button>
                </div>
                <input
                  className="input min-w-0 flex-1"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={discountValue}
                  placeholder="0"
                  onChange={(event) => setDiscountValue(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="settle-service">{tr('restaurant.settle.serviceChargeRate', 'Service charge %')}</label>
              <input
                id="settle-service"
                className="input"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={serviceCharge}
                placeholder={tr('restaurant.settle.useBusinessDefault', 'Business default')}
                onChange={(event) => setServiceCharge(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="settle-packaging">{tr('restaurant.settle.packaging', 'Packaging')}</label>
              <input
                id="settle-packaging"
                className="input"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={packagingCharge}
                placeholder="0"
                onChange={(event) => setPackagingCharge(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-secondary-200 bg-secondary-50/60 p-4">
            {summaryRow(tr('restaurant.bill.subtotal', 'Subtotal'), bill ? formatMoney(bill.subTotal) : '--')}
            {bill && bill.discountTotal > 0
              ? summaryRow(tr('restaurant.bill.discount', 'Discount'), `-${formatMoney(bill.discountTotal)}`)
              : null}
            {bill && bill.serviceCharge > 0
              ? summaryRow(tr('restaurant.bill.service', 'Service charge'), formatMoney(bill.serviceCharge))
              : null}
            {bill && bill.packagingCharge > 0
              ? summaryRow(tr('restaurant.bill.packaging', 'Packaging'), formatMoney(bill.packagingCharge))
              : null}
            {bill && bill.taxTotal > 0
              ? summaryRow(tr('restaurant.bill.tax', 'Tax'), formatMoney(bill.taxTotal))
              : null}
            <div className="border-t border-secondary-200 pt-2">
              {summaryRow(tr('restaurant.bill.total', 'Total'), bill ? formatMoney(payable) : '--', true)}
            </div>
            {preview.loading ? (
              <p className="text-xs text-secondary-500">{tr('restaurant.settle.updating', 'Updating...')}</p>
            ) : null}
          </div>
        </div>

        {/* Right: split + payments */}
        <div className="space-y-4">
          <div>
            <p className="label">{tr('restaurant.settle.split', 'Split bill')}</p>
            <div className="flex gap-2">
              <button type="button" className={segmentClass(splitMode === 'none')} onClick={() => changeSplitMode('none')}>
                {tr('restaurant.settle.splitNone', 'Whole bill')}
              </button>
              <button type="button" className={segmentClass(splitMode === 'equal')} onClick={() => changeSplitMode('equal')}>
                {tr('restaurant.settle.splitEqual', 'Equal')}
              </button>
              <button type="button" className={segmentClass(splitMode === 'items')} onClick={() => changeSplitMode('items')}>
                {tr('restaurant.settle.splitItems', 'By items')}
              </button>
            </div>

            {splitMode === 'equal' ? (
              <div className="mt-3 flex items-center gap-3">
                <label className="label mb-0" htmlFor="settle-split-count">
                  {tr('restaurant.settle.people', 'People')}
                </label>
                <input
                  id="settle-split-count"
                  className="input w-24"
                  type="number"
                  min="2"
                  max="20"
                  inputMode="numeric"
                  value={splitCount}
                  onChange={(event) => setSplitCount(event.target.value)}
                />
              </div>
            ) : null}

            {splitMode === 'items' ? (
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-secondary-200 p-2">
                {billableItems.map((item) => (
                  <li key={item.id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm hover:bg-secondary-50">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.quantity}&times; {item.name}</span>
                      <span className="font-semibold">{formatMoney(item.lineTotal)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {canChargeToRoom ? (
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-secondary-200 bg-white px-4 text-sm font-medium">
              <span className="flex items-center gap-2">
                <BedDouble size={18} className="text-primary" />
                {tr('restaurant.settle.toRoom', 'Charge to guest room')}
              </span>
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={chargeToRoom}
                onChange={(event) => setChargeToRoom(event.target.checked)}
              />
            </label>
          ) : null}

          {!chargeToRoom ? (
            <div className="space-y-3">
              <p className="label">{tr('restaurant.settle.payment', 'Payment')}</p>
              {rows.map((row, index) => (
                <div key={row.id} className="space-y-2 rounded-2xl border border-secondary-200 bg-white p-3">
                  {splitMode === 'equal' ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary-500">
                      {tr('restaurant.settle.person', 'Person {n}', { n: index + 1 })}
                    </p>
                  ) : null}
                  <PaymentMethodFields
                    variant="segmented"
                    value={{ paymentMethod: row.paymentMethod, bankId: row.bankId }}
                    onChange={(next) => updateRow(row.id, { paymentMethod: next.paymentMethod, bankId: next.bankId })}
                  />
                  <div className="flex items-center gap-2">
                    {mixed ? (
                      <>
                        <input
                          className="input min-w-0 flex-1"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={row.amount}
                          placeholder="0"
                          aria-label={tr('restaurant.settle.amount', 'Amount')}
                          onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                        />
                        <button type="button" className="btn-ghost text-xs" onClick={() => fillRemaining(row.id)}>
                          {tr('restaurant.settle.fillRest', 'Fill rest')}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl p-2 text-rose-600 hover:bg-rose-50"
                          onClick={() => removeRow(row.id)}
                          aria-label={tr('common.delete', 'Delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-ink">{formatMoney(rowAmount(row, index))}</p>
                    )}
                  </div>
                </div>
              ))}

              {splitMode !== 'equal' ? (
                <button type="button" className="btn-secondary w-full justify-center" onClick={addMethod}>
                  <Plus size={16} />
                  {tr('restaurant.settle.addMethod', 'Add another method')}
                </button>
              ) : null}

              {!paymentsBalanced && bill ? (
                <p className="text-sm font-semibold text-amber-700">
                  {remaining > 0
                    ? tr('restaurant.settle.remaining', 'Remaining: {amount}', { amount: formatMoney(remaining) })
                    : tr('restaurant.settle.over', 'Over by {amount}', { amount: formatMoney(Math.abs(remaining)) })}
                </p>
              ) : null}
              {bankMissing ? (
                <p className="text-sm font-semibold text-amber-700">
                  {tr('restaurant.settle.pickBank', 'Select a bank account for bank payments.')}
                </p>
              ) : null}
            </div>
          ) : (
            <Notice
              tone="info"
              title={tr('restaurant.settle.roomNotice', 'This bill will be added to the guest room folio.')}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
}
