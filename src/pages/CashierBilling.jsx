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
  FileText,
  Ban,
  DollarSign,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
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
  const [floors, setFloors] = useState([]);
  const [selectedFloorFilter, setSelectedFloorFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
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
  const [successState, setSuccessState] = useState(null);

  // Load Tables & Active Unpaid Sales
  const loadData = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [tablesResponse, salesResponse, categoriesResponse] = await Promise.all([
        api.getTables({ isActive: 'true', limit: 100 }),
        api.listSales({ limit: 120 }),
        api.listCategories({ type: 'table', limit: 100 }).catch(() => null),
      ]);

      const items = tablesResponse?.items || tablesResponse || [];
      setTables(Array.isArray(items) ? items : []);

      const saleItems = salesResponse?.items || salesResponse || [];
      const dueSales = Array.isArray(saleItems) ? saleItems.filter((s) => s.status === 'due') : [];
      setSales(dueSales);

      setFloors(categoriesResponse?.items || []);
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
    return tableMap.filter((table) => {
      if (selectedFloorFilter !== 'all') {
        if (selectedFloorFilter === 'unassigned') {
          if (table.categoryId || table.category?.id) return false;
        } else {
          const catId = table.categoryId || table.category?.id;
          if (String(catId) !== String(selectedFloorFilter)) return false;
        }
      }

      if (selectedStatusFilter !== 'all') {
        const isOccupied = table.occupied;
        if (selectedStatusFilter === 'vacant' && isOccupied) return false;
        if (selectedStatusFilter === 'occupied' && !isOccupied) return false;
      }

      return true;
    });
  }, [tableMap, selectedFloorFilter, selectedStatusFilter]);

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
      const rawItems = fullSale.SaleItems || [];
      const uniqueItems = [];
      const seen = new Set();
      for (const item of rawItems) {
        if (!seen.has(item.productId)) {
          seen.add(item.productId);
          uniqueItems.push(item);
        }
      }
      const correctSubTotal = uniqueItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
      const discountAmount = Math.max(Number(fullSale.discount || 0), 0);
      const beforeTax = Math.max(correctSubTotal - discountAmount, 0);
      const taxRate = Number(fullSale.taxRate || 0);
      const correctGrandTotal = beforeTax + (beforeTax * taxRate) / 100;

      setActiveSale(fullSale);
      setCheckoutForm({
        amountReceived: String(correctGrandTotal.toFixed(2)),
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

    const rawItems = activeSale.SaleItems || [];
    const items = [];
    const seenProducts = new Set();
    for (const item of rawItems) {
      if (!seenProducts.has(item.productId)) {
        seenProducts.add(item.productId);
        items.push(item);
      }
    }

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

  const changeAmount = useMemo(() => {
    const received = Number(checkoutForm.amountReceived || 0);
    const total = computedTotals.grandTotal;
    return Math.max(received - total, 0);
  }, [checkoutForm.amountReceived, computedTotals.grandTotal]);

  // Adjust received amount dynamically on discount changes
  const handleDiscountChange = (val) => {
    setCheckoutForm((prev) => {
      const nextDiscount = val;
      const rawItems = activeSale?.SaleItems || [];
      const items = [];
      const seen = new Set();
      for (const item of rawItems) {
        if (!seen.has(item.productId)) {
          seen.add(item.productId);
          items.push(item);
        }
      }
      const subTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
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
      const rawItems = activeSale?.SaleItems || [];
      const items = [];
      const seen = new Set();
      for (const item of rawItems) {
        if (!seen.has(item.productId)) {
          seen.add(item.productId);
          items.push(item);
        }
      }
      const subTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
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
      const apiAmountReceived = isPaidBill ? computedTotals.grandTotal : received;

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
        amountReceived: apiAmountReceived,
        discount: computedTotals.discountTotal,
        discountTotal: computedTotals.discountTotal,
        taxRate: Number(checkoutForm.taxRate || 0),
        taxTotal: computedTotals.taxTotal,
        grandTotal: computedTotals.grandTotal,
        subTotal: computedTotals.subTotal,
        attributes: resolvedAttributes,
        ...(received > 0 ? buildPaymentPayload(paymentPayload) : { paymentMethod: 'cash' }),
        items: (() => {
          const rawItems = activeSale.SaleItems || [];
          const unique = [];
          const duplicates = [];
          const seen = new Set();
          for (const item of rawItems) {
            if (!seen.has(item.productId)) {
              seen.add(item.productId);
              unique.push(item);
            } else {
              duplicates.push(item);
            }
          }
          return [
            ...unique.map((item) => ({
              id: item.id,
              productId: item.productId,
              quantity: Number(item.quantity || 0),
              unitType: item.unitType || 'primary',
              conversionRate: Number(item.conversionRate || 0),
              unitPrice: Number(item.unitPrice || 0),
              taxRate: Number(item.taxRate || 0),
              lineTotal: Number(item.lineTotal || 0),
            })),
            ...duplicates.map((item) => ({
              id: item.id,
              _delete: true,
            })),
          ];
        })(),
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
        <div className="space-y-4 min-w-0">
          <div className="flex flex-col gap-3 bg-white/40 backdrop-blur p-4 rounded-2xl border border-slate-100 shadow-sm">
            {/* Floor Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap shrink-0">Floor:</span>
              <button
                type="button"
                onClick={() => setSelectedFloorFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedFloorFilter === 'all'
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
                  onClick={() => setSelectedFloorFilter(floor.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    selectedFloorFilter === floor.id
                      ? 'bg-[#9c5f22] text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {floor.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedFloorFilter('unassigned')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedFloorFilter === 'unassigned'
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
                onClick={() => setSelectedStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedStatusFilter === 'all'
                    ? 'bg-[#9c5f22] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('vacant')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedStatusFilter === 'vacant'
                    ? 'bg-[#9c5f22] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                Vacant
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('occupied')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedStatusFilter === 'occupied'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                Occupied
              </button>
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
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-serif text-base font-bold text-slate-800 group-hover:text-[#9c5f22] transition truncate">
                            {table.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-0.5 whitespace-nowrap">
                            {table.capacity ? `${table.capacity} seats` : 'No seats config'}
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap ${
                              table.occupied
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {table.occupied ? 'Occupied' : 'Vacant'}
                          </span>
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200/50 truncate max-w-[80px]">
                            {table.category?.name || "No Floor"}
                          </span>
                        </div>
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
        <div className="hidden lg:block lg:col-span-1">
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
                  {(() => {
                    const rawItems = activeSale.SaleItems || [];
                    const items = [];
                    const seen = new Set();
                    for (const item of rawItems) {
                      if (!seen.has(item.productId)) {
                        seen.add(item.productId);
                        items.push(item);
                      }
                    }
                    return items.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-800 truncate">{item.productName || item.Product?.name || 'Unknown Item'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {item.quantity} x {formatMoney(item.unitPrice)}
                          </p>
                        </div>
                        <span className="font-bold text-slate-800 shrink-0">{formatMoney(item.lineTotal)}</span>
                      </div>
                    ));
                  })()}
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
                  <div className="flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition">
                    <span className="flex h-11 items-center bg-slate-100 px-3.5 text-sm font-semibold text-slate-500 border-r border-slate-200 shrink-0">
                      {t("currency.symbol") || "Rs"}
                    </span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      className="h-11 w-full bg-transparent px-3 text-sm font-bold text-slate-900 focus:outline-none"
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

                {/* Change return section */}
                {changeAmount > 0 && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex justify-between items-center text-sm font-bold shadow-sm">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={16} className="text-emerald-600" />
                      Change to Return
                    </span>
                    <span className="text-base text-emerald-700">{formatMoney(changeAmount)}</span>
                  </div>
                )}

                {/* Payment Method Fields */}
                <PaymentMethodFields
                  value={checkoutForm}
                  onChange={(patch) => setCheckoutForm((prev) => ({ ...prev, ...patch }))}
                  showPaymentNote={false}
                />
              </div>

              {/* Final Actions */}
              <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
                <div className="flex gap-2.5">
                  <Link
                    to={`/app/pos?tableId=${selectedTable.id}&checkout=1&ref=billing`}
                    className="btn-secondary flex-1 justify-center rounded-xl py-3 text-xs font-bold text-center gap-1.5 bg-amber-50/70 border-amber-200/80 text-amber-800 hover:bg-amber-100"
                  >
                    <Sparkles size={14} className="text-amber-600 shrink-0" />
                    Review Bill (POS)
                  </Link>
                  <Link
                    to={`/app/pos?tableId=${selectedTable.id}&ref=billing`}
                    className="btn-secondary flex-1 justify-center rounded-xl py-3 text-xs font-bold text-center"
                  >
                    Edit Items (POS)
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full justify-center rounded-xl py-3.5 text-sm font-black"
                >
                  {submitting ? 'Processing...' : 'Complete Seating Bill'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Mobile Billing Counter Popup Modal */}
        <div className="lg:hidden">
          <Dialog
            isOpen={Boolean(selectedTable || successState)}
            onClose={() => {
              setSelectedTable(null);
              setSuccessState(null);
            }}
            title={selectedTable ? `Billing - ${selectedTable.name}` : successState ? 'Receipt' : 'Checkout'}
            size="lg"
          >
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
            ) : !selectedTable ? null : loadingSaleDetails ? (
              <div className="card bg-white p-8 border border-slate-100 flex flex-col items-center justify-center min-h-[300px]">
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
              <form onSubmit={handleCheckout} className="space-y-5">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Checkout {selectedTable.name}</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Bill: {activeSale.invoiceNo || activeSale.id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Occupied
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Order Summary</p>
                  <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50 bg-slate-50/30">
                    {(() => {
                      const rawItems = activeSale.SaleItems || [];
                      const items = [];
                      const seen = new Set();
                      for (const item of rawItems) {
                        if (!seen.has(item.productId)) {
                          seen.add(item.productId);
                          items.push(item);
                        }
                      }
                      return items.map((item) => (
                        <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-slate-800 truncate">{item.productName || item.Product?.name || 'Unknown Item'}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {item.quantity} x {formatMoney(item.unitPrice)}
                            </p>
                          </div>
                          <span className="font-bold text-slate-800 shrink-0">{formatMoney(item.lineTotal)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Discount and Taxes inputs */}
                <div className="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-3">
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
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Payment Collection</p>

                  <div className="space-y-1.5">
                    <label className="label">Amount Received</label>
                    <div className="flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition">
                      <span className="flex h-11 items-center bg-slate-100 px-3.5 text-sm font-semibold text-slate-500 border-r border-slate-200 shrink-0">
                        {t("currency.symbol") || "Rs"}
                      </span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        className="h-11 w-full bg-transparent px-3 text-sm font-bold text-slate-900 focus:outline-none"
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

                  {/* Change return section */}
                  {changeAmount > 0 && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex justify-between items-center text-sm font-bold shadow-sm">
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={16} className="text-emerald-600" />
                        Change to Return
                      </span>
                      <span className="text-base text-emerald-700">{formatMoney(changeAmount)}</span>
                    </div>
                  )}

                  {/* Payment Method Fields */}
                  <PaymentMethodFields
                    value={checkoutForm}
                    onChange={(patch) => setCheckoutForm((prev) => ({ ...prev, ...patch }))}
                    showPaymentNote={false}
                  />
                </div>

                {/* Final Actions */}
                <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3">
                  <div className="flex gap-2.5">
                    <Link
                      to={`/app/pos?tableId=${selectedTable.id}&checkout=1&ref=billing`}
                      className="btn-secondary flex-1 justify-center rounded-xl py-3 text-xs font-bold text-center gap-1.5 bg-amber-50/70 border-amber-200/80 text-amber-800 hover:bg-amber-100"
                    >
                      <Sparkles size={14} className="text-amber-600 shrink-0" />
                      Review Bill (POS)
                    </Link>
                    <Link
                      to={`/app/pos?tableId=${selectedTable.id}&ref=billing`}
                      className="btn-secondary flex-1 justify-center rounded-xl py-3 text-xs font-bold text-center"
                    >
                      Edit Items (POS)
                    </Link>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full justify-center rounded-xl py-3.5 text-sm font-black"
                  >
                    {submitting ? 'Processing...' : 'Complete Seating Bill'}
                  </button>
                </div>
              </form>
            )}
          </Dialog>
        </div>
      </div>
    </div>
  );
}
