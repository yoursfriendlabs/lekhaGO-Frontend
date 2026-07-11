import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Coffee,
  Receipt,
  Users,
  Clock,
  AlertCircle,
  ShoppingCart,
  RefreshCw,
  Printer,
  Check,
  Search,
  FileText,
  Ban,
  DollarSign,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSnackbar } from '../lib/snackbar.jsx';
import { todayISODate } from '../lib/datetime';
import { buildPaymentPayload, requiresBankSelection } from '../lib/payments';

export default function CashierBilling() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { businessId } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const { showError, showSuccess } = useSnackbar();

  // Data States
  const [tables, setTables] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: 'info', message: '' });

  // Selected Table & Sale Details
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeSale, setActiveSale] = useState(null);
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false);

  // Form States
  const [checkoutForm, setCheckoutForm] = useState({
    amountReceived: '0',
    discount: '0',
    taxRate: '0',
    paymentMethod: 'cash',
    bankId: '',
    paymentNote: '',
  });

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [successState, setSuccessState] = useState(null);

  // Load Tables & Active Unpaid Sales
  const loadData = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [tablesResponse, salesResponse] = await Promise.all([
        api.getTables({ isActive: 'true', limit: 100 }),
        api.listSales({ limit: 120 }),
      ]);

      const items = tablesResponse?.items || tablesResponse || [];
      setTables(Array.isArray(items) ? items : []);

      const saleItems = salesResponse?.items || salesResponse || [];
      const dueSales = Array.isArray(saleItems) ? saleItems.filter((s) => s.status === 'due') : [];
      setSales(dueSales);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to load counter data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessId]);

  // Map Tables with their corresponding Active Unpaid Sales
  const tableMap = useMemo(() => {
    return tables.map((table) => {
      const activeSale = sales.find((s) => String(s.tableId) === String(table.id));
      return {
        ...table,
        activeSale,
        occupied: table.status === 'occupied' || Boolean(activeSale),
      };
    });
  }, [tables, sales]);

  // Statistics
  const stats = useMemo(() => {
    const total = tableMap.length;
    const occupied = tableMap.filter((t) => t.occupied).length;
    const vacant = total - occupied;
    const openBillAmount = sales.reduce((sum, s) => sum + Number(s.dueAmount || s.grandTotal || 0), 0);

    return { total, occupied, vacant, openBillAmount };
  }, [tableMap, sales]);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tableMap.filter((t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tableMap, searchQuery]);

  // Select Table & Fetch Full Sale Details (with Items)
  const handleSelectTable = async (table) => {
    if (submitting) return;
    setSelectedTable(table);
    setSuccessState(null);
    setStatus({ type: 'info', message: '' });

    if (!table.activeSale) {
      setActiveSale(null);
      return;
    }

    setLoadingSaleDetails(true);
    try {
      const fullSale = await api.getSale(table.activeSale.id);
      setActiveSale(fullSale);
      setCheckoutForm({
        amountReceived: String(fullSale.grandTotal || 0),
        discount: String(fullSale.discount || 0),
        taxRate: String(fullSale.taxRate || 0),
        paymentMethod: fullSale.paymentMethod || 'cash',
        bankId: fullSale.bankId || '',
        paymentNote: fullSale.paymentNote || '',
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to load order details.' });
    } finally {
      setLoadingSaleDetails(false);
    }
  };

  // Release a table manually (if occupied but has no active invoice)
  const handleReleaseTable = async (table) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await api.updateTable(table.id, { status: 'vacant' });
      setSelectedTable(null);
      await loadData();
      showSuccess(`Table ${table.name} has been released.`);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to release table.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic Totals calculation when discount or tax updates
  const computedTotals = useMemo(() => {
    if (!activeSale) return { subTotal: 0, taxTotal: 0, discountTotal: 0, grandTotal: 0 };

    const items = activeSale.SaleItems || [];
    const subTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const discountAmount = Math.max(Number(checkoutForm.discount || 0), 0);
    const beforeTax = Math.max(subTotal - discountAmount, 0);
    const taxRate = Number(checkoutForm.taxRate || 0);
    const taxTotal = (beforeTax * taxRate) / 100;
    const grandTotal = beforeTax + taxTotal;

    return {
      subTotal,
      discountTotal: discountAmount,
      taxTotal,
      grandTotal,
    };
  }, [activeSale, checkoutForm.discount, checkoutForm.taxRate]);

  // Adjust received amount dynamically on discount changes
  const handleDiscountChange = (val) => {
    setCheckoutForm((prev) => {
      const nextDiscount = val;
      const subTotal = activeSale?.SaleItems?.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0) || 0;
      const beforeTax = Math.max(subTotal - Number(nextDiscount || 0), 0);
      const taxRate = Number(prev.taxRate || 0);
      const nextGrand = beforeTax + (beforeTax * taxRate) / 100;

      return {
        ...prev,
        discount: nextDiscount,
        amountReceived: String(nextGrand.toFixed(2)),
      };
    });
  };

  // Adjust received amount dynamically on tax changes
  const handleTaxRateChange = (val) => {
    setCheckoutForm((prev) => {
      const nextTaxRate = val;
      const subTotal = activeSale?.SaleItems?.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0) || 0;
      const discountAmount = Number(prev.discount || 0);
      const beforeTax = Math.max(subTotal - discountAmount, 0);
      const nextGrand = beforeTax + (beforeTax * Number(nextTaxRate || 0)) / 100;

      return {
        ...prev,
        taxRate: nextTaxRate,
        amountReceived: String(nextGrand.toFixed(2)),
      };
    });
  };

  // Quick cash amount pad calculation
  const quickAmountOptions = useMemo(() => {
    const total = computedTotals.grandTotal;
    if (total <= 0) return [];

    const options = [{ label: 'Exact', value: total }];

    const round50 = Math.ceil(total / 50) * 50;
    if (round50 > total) options.push({ label: `Rs. ${round50}`, value: round50 });

    const round100 = Math.ceil(total / 100) * 100;
    if (round100 > round50) options.push({ label: `Rs. ${round100}`, value: round100 });

    const round500 = Math.ceil(total / 500) * 500;
    if (round500 > round100) options.push({ label: `Rs. ${round500}`, value: round500 });

    const round1000 = Math.ceil(total / 1000) * 1000;
    if (round1000 > round500) options.push({ label: `Rs. ${round1000}`, value: round1000 });

    return options;
  }, [computedTotals.grandTotal]);

  // Complete Payment & Vacate Seating
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (submitting || !activeSale) return;

    const received = Number(checkoutForm.amountReceived || 0);

    if (requiresBankSelection(checkoutForm, received)) {
      setStatus({ type: 'error', message: 'Please select a bank account for bank transactions.' });
      return;
    }

    try {
      setSubmitting(true);
      setStatus({ type: 'info', message: '' });

      const isPaidBill = received >= computedTotals.grandTotal;

      const paymentPayload = {
        paymentMethod: checkoutForm.paymentMethod,
        bankId: checkoutForm.paymentMethod === 'bank' ? checkoutForm.bankId : null,
        paymentNote: checkoutForm.paymentNote || '',
      };

      const resolvedAttributes = {
        ...(activeSale.attributes || {}),
        order_status: 'completed', // Billed drafts are set to completed
      };

      const salePayload = {
        ...activeSale,
        status: isPaidBill ? 'paid' : 'due',
        amountReceived: received,
        discount: computedTotals.discountTotal,
        discountTotal: computedTotals.discountTotal,
        taxRate: Number(checkoutForm.taxRate || 0),
        taxTotal: computedTotals.taxTotal,
        grandTotal: computedTotals.grandTotal,
        subTotal: computedTotals.subTotal,
        attributes: resolvedAttributes,
        ...(received > 0 ? buildPaymentPayload(paymentPayload) : { paymentMethod: 'cash' }),
        items: (activeSale.SaleItems || []).map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          unitType: item.unitType || 'primary',
          conversionRate: Number(item.conversionRate || 0),
          unitPrice: Number(item.unitPrice || 0),
          taxRate: Number(item.taxRate || 0),
          lineTotal: Number(item.lineTotal || 0),
        })),
      };

      const updatedSale = await api.updateSale(activeSale.id, salePayload);

      // Clean/Vacate the table
      if (activeSale.tableId) {
        await api.updateTable(activeSale.tableId, { status: isPaidBill ? 'vacant' : 'occupied' });
      }

      setSuccessState({
        id: updatedSale?.id || activeSale.id,
        invoiceNo: updatedSale?.invoiceNo || activeSale.invoiceNo || activeSale.id.slice(0, 8),
        total: computedTotals.grandTotal,
        isPaid: isPaidBill,
      });

      setSelectedTable(null);
      setActiveSale(null);
      await loadData();
      showSuccess('Transaction completed successfully.');
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Checkout failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatMoney = (val) => {
    return t('currency.formatted', {
      symbol: t('currency.symbol') || 'Rs',
      amount: Number(val || 0).toFixed(2),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.billing') || 'Billing Counter'}
        subtitle="Manage checkouts, collect payments, and vacate cafe tables in real time."
        action={
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary h-11 px-4 gap-2 flex items-center justify-center rounded-2xl"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh') || 'Refresh'}
          </button>
        }
      />

      {status.message && (
        <Notice
          title={status.message}
          tone={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : 'info'}
        />
      )}

      {/* Top Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card bg-white p-5 flex items-center justify-between shadow-sm border border-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Tables</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500">
            <Coffee size={20} />
          </div>
        </div>

        <div className="card bg-white p-5 flex items-center justify-between shadow-sm border border-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Tables</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{stats.occupied}</p>
          </div>
          <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
        </div>

        <div className="card bg-white p-5 flex items-center justify-between shadow-sm border border-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vacant Tables</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.vacant}</p>
          </div>
          <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        <div className="card bg-white p-5 flex items-center justify-between shadow-sm border border-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due Amount</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{formatMoney(stats.openBillAmount)}</p>
          </div>
          <div className="h-10 w-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px]">
        {/* Left Side: Tables Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white/40 backdrop-blur p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                className="input pl-9 h-10 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tables by name..."
              />
            </div>
          </div>

          {loading ? (
            <div className="card bg-white p-12 text-center text-slate-500 border border-slate-100 flex flex-col items-center justify-center h-64">
              <span className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin inline-block mb-3" />
              <p className="text-sm font-semibold">Loading cafe seating map...</p>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="card bg-white p-12 text-center text-slate-400 border border-slate-100">
              <Coffee size={40} className="mx-auto mb-3 opacity-30 text-slate-500" />
              <p className="text-sm font-semibold">No seating tables found.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {filteredTables.map((table) => {
                const isSelected = selectedTable?.id === table.id;
                const hasOrder = Boolean(table.activeSale);
                const orderAmount = table.activeSale?.dueAmount || table.activeSale?.grandTotal || 0;

                return (
                  <button
                    key={table.id}
                    onClick={() => handleSelectTable(table)}
                    className={`card bg-white p-5 border text-left flex flex-col justify-between h-40 transition relative group ${
                      isSelected
                        ? 'border-[#9c5f22] ring-2 ring-[#9c5f22]/20 shadow-md'
                        : table.occupied
                        ? 'border-amber-200 hover:border-amber-300 bg-amber-50/5'
                        : 'border-emerald-100 hover:border-emerald-200 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-serif text-lg font-bold text-slate-800 group-hover:text-[#9c5f22] transition truncate max-w-[140px]">
                            {table.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-0.5">
                            {table.capacity ? `${table.capacity} seats` : 'No seats config'}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            table.occupied
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {table.occupied ? 'Occupied' : 'Vacant'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-50 pt-3 flex items-center justify-between w-full">
                      {hasOrder ? (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Active Bill</p>
                          <p className="text-base font-bold text-slate-800">{formatMoney(orderAmount)}</p>
                        </div>
                      ) : table.occupied ? (
                        <div className="text-slate-400 text-xs italic">Booked / Dirty</div>
                      ) : (
                        <div className="text-emerald-600 text-xs font-semibold">Ready to Seat</div>
                      )}

                      <span className="p-1 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-[#9c5f22]/10 group-hover:text-[#9c5f22] transition">
                        <ChevronRight size={16} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Billing Checkout Panel */}
        <div className="lg:col-span-1">
          {successState ? (
            <div className="card bg-white p-6 shadow-md border border-emerald-100 space-y-6 text-center">
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                <Check size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Checkout Complete!</h3>
                <p className="text-sm text-slate-500">
                  Bill {successState.invoiceNo} has been marked as{' '}
                  <span className="font-semibold text-emerald-600">Paid</span>.
                </p>
                <p className="text-2xl font-black text-slate-800">{formatMoney(successState.total)}</p>
              </div>

              <div className="flex flex-col gap-2.5 pt-4">
                <Link
                  to={`/app/invoice/sales/${successState.id}?print=1`}
                  className="btn-primary w-full justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
                >
                  <Printer size={16} />
                  Print Receipt
                </Link>
                <button
                  onClick={() => setSuccessState(null)}
                  className="btn-ghost w-full justify-center rounded-xl py-3 text-sm font-semibold"
                >
                  Clear & Close
                </button>
              </div>
            </div>
          ) : !selectedTable ? (
            <div className="card bg-slate-50/50 border border-dashed border-slate-200 p-8 text-center text-slate-400/80 flex flex-col items-center justify-center min-h-[400px]">
              <Receipt size={48} className="text-slate-300 mb-4 animate-bounce" />
              <p className="text-base font-bold text-slate-600">No Seating Selected</p>
              <p className="text-xs mt-1 max-w-[240px] mx-auto text-slate-400">
                Click any occupied table on the floor map to review items and complete the payment.
              </p>
            </div>
          ) : loadingSaleDetails ? (
            <div className="card bg-white p-8 border border-slate-100 flex flex-col items-center justify-center min-h-[400px]">
              <span className="h-8 w-8 rounded-full border-2 border-[#9c5f22] border-t-transparent animate-spin mb-3" />
              <p className="text-sm text-slate-500 font-semibold">Loading active table order...</p>
            </div>
          ) : !activeSale ? (
            <div className="card bg-white p-6 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-800">{selectedTable.name} Details</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  selectedTable.occupied
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {selectedTable.occupied ? 'Occupied (Empty)' : 'Vacant Seating'}
                </span>
              </div>

              <div className="text-center py-6 text-slate-400 space-y-4">
                <Coffee size={36} className="mx-auto text-slate-300" />
                <div>
                  <p className="text-sm font-bold text-slate-600">Table is empty</p>
                  <p className="text-xs mt-1 text-slate-400/80">No active bill or draft order exists on this table.</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-50">
                <Link
                  to={`/app/pos?tableId=${selectedTable.id}&ref=billing`}
                  className="btn-primary w-full justify-center rounded-xl py-3 text-sm font-semibold"
                >
                  Start New Order (POS)
                </Link>
                {selectedTable.occupied && (
                  <button
                    onClick={() => handleReleaseTable(selectedTable)}
                    disabled={submitting}
                    className="btn-ghost w-full justify-center gap-2 rounded-xl py-3 text-rose-600 border-rose-100 hover:bg-rose-50/50 text-sm font-semibold"
                  >
                    <Ban size={14} />
                    Release Table (Vacate)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCheckout} className="card bg-white p-6 shadow-md border border-slate-100 space-y-6">
              {/* Header section */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Checkout {selectedTable.name}</h3>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    Bill: {activeSale.invoiceNo || activeSale.id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Occupied
                  </span>
                  {activeSale.createdAt && (
                    <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-semibold">
                      <Clock size={10} />
                      {new Date(activeSale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Order Summary</p>
                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50 bg-slate-50/30">
                  {(activeSale.SaleItems || []).map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{item.productName || item.Product?.name || 'Unknown Item'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.quantity} x {formatMoney(item.unitPrice)}
                        </p>
                      </div>
                      <span className="font-bold text-slate-800 shrink-0">{formatMoney(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount and Taxes inputs */}
              <div className="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-4">
                <div>
                  <label className="label">Discount (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    className="input h-10 mt-1"
                    value={checkoutForm.discount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Tax Rate (%)</label>
                  <select
                    className="input h-10 mt-1"
                    value={checkoutForm.taxRate}
                    onChange={(e) => handleTaxRateChange(e.target.value)}
                  >
                    <option value="0">0% (No Tax)</option>
                    <option value="5">5%</option>
                    <option value="13">13% (VAT)</option>
                    <option value="15">15%</option>
                  </select>
                </div>
              </div>

              {/* Recalculated Breakdowns */}
              <div className="rounded-2xl bg-slate-50/80 p-4 space-y-2 border border-slate-100 text-sm">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Subtotal</span>
                  <span>{formatMoney(computedTotals.subTotal)}</span>
                </div>
                {computedTotals.discountTotal > 0 && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>Discount</span>
                    <span>-{formatMoney(computedTotals.discountTotal)}</span>
                  </div>
                )}
                {computedTotals.taxTotal > 0 && (
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Tax ({checkoutForm.taxRate}%)</span>
                    <span>{formatMoney(computedTotals.taxTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 border-t border-slate-200/60 pt-2 text-base">
                  <span>Grand Total</span>
                  <span className="text-primary">{formatMoney(computedTotals.grandTotal)}</span>
                </div>
              </div>

              {/* Financial Transaction Input */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Payment Collection</p>

                <div className="space-y-1.5">
                  <label className="label">Amount Received</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm font-semibold">
                      Rs
                    </span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      className="input pl-9 h-11"
                      value={checkoutForm.amountReceived}
                      onChange={(e) => setCheckoutForm((prev) => ({ ...prev, amountReceived: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Quick Cash Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {quickAmountOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCheckoutForm((prev) => ({ ...prev, amountReceived: String(opt.value.toFixed(2)) }))}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-[#9c5f22] text-xs font-bold text-slate-600 bg-white hover:bg-[#9c5f22]/5 transition shadow-sm"
                    >
                      {opt.label === 'Exact' ? `Exact (${opt.value.toFixed(0)})` : opt.label}
                    </button>
                  ))}
                </div>

                {/* Payment Method Fields */}
                <PaymentMethodFields
                  value={checkoutForm}
                  onChange={(patch) => setCheckoutForm((prev) => ({ ...prev, ...patch }))}
                  showPaymentNote={false}
                />
              </div>

              {/* Final Actions */}
              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <Link
                  to={`/app/pos?tableId=${selectedTable.id}&ref=billing`}
                  className="btn-secondary flex-1 justify-center rounded-xl py-3.5 text-sm font-semibold text-center"
                >
                  Edit Order (POS)
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-[1.5] justify-center rounded-xl py-3.5 text-sm font-black"
                >
                  {submitting ? 'Processing...' : 'Complete Seating Bill'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
