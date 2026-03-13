import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Notice from '../components/Notice';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

export default function Invoice() {
  const { type, id } = useParams();
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const loader = type === 'sales' ? api.getSale : api.getPurchase;
    loader(id)
      .then(setRecord)
      .catch((err) => setStatus(err.message));
  }, [type, id]);

  const isSale = type === 'sales';
  const label = isSale ? 'Sale' : 'Purchase';
  const dateValue = isSale ? record?.saleDate : record?.purchaseDate;
  const items = record?.PurchaseItems || record?.SaleItems || [];
  const totalReceived = isSale
    ? Number(record?.amountReceived ?? (record?.status === 'paid' ? record?.grandTotal : 0) ?? 0)
    : 0;
  const totalPaid = !isSale
    ? Number(record?.amountReceived ?? (record?.status === 'received' ? record?.grandTotal : 0) ?? 0)
    : 0;
  const dueAmount = Number(
    record?.dueAmount ??
      Math.max(Number(record?.grandTotal || 0) - (isSale ? totalReceived : totalPaid), 0)
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link className="btn-ghost" to={type === 'sales' ? '/app/sales' : '/app/purchases'}>
          Back
        </Link>
        <button className="btn-primary" type="button" onClick={() => window.print()}>
          Download PDF
        </button>
      </div>
      {status ? <Notice title={status} tone="error" /> : null}
      {record ? (
        <div className="print-area">
          <div className="card print:shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-serif text-3xl text-slate-900 dark:text-white">{label} Invoice</h1>
              <p className="text-slate-500">#{record.invoiceNo || record.id.slice(0, 8)}</p>
            </div>
            <div className="text-right text-sm text-slate-600 dark:text-slate-300">
              <p>Date: {formatDate(dateValue)}</p>
              <p>Status: {record.status}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-400">Business</p>
              <p>ManageMyShop</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Notes</p>
              <p>{record.notes || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">{isSale ? 'Customer' : 'Supplier'}</p>
              <p>
                {isSale
                  ? record.Customer?.name || record.customerName || record.customerId || 'Walk-in'
                  : record.Supplier?.name || record.supplierName || record.supplierId || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">{isSale ? 'Received' : 'Paid'}</p>
              <p>${isSale ? totalReceived.toFixed(2) : totalPaid.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-200/70 pt-4 dark:border-slate-800/70">
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm text-slate-600 dark:text-slate-300">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 text-left">Product</th>
                    <th className="py-2 text-left">Company</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit</th>
                    <th className="py-2 text-right">Tax %</th>
                    <th className="py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="py-3 text-slate-500">No line items.</td></tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                        <td className="py-2">{item.Product?.name || item.description || item.productId || '—'}</td>
                        <td className="py-2">{item.Product?.companyName || '—'}</td>
                        <td className="py-2 text-right">{Number(item.quantity || 0).toFixed(2)}</td>
                        <td className="py-2 text-right">Rs {Number(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="py-2 text-right">{Number(item.taxRate || 0).toFixed(2)}</td>
                        <td className="py-2 text-right">Rs {Number(item.lineTotal || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>Rs {Number(record.subTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>Rs {Number(record.taxTotal || 0).toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between text-base font-semibold">
              <span>Grand total</span>
              <span>Rs {Number(record.grandTotal || 0).toFixed(2)}</span>
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span>{isSale ? 'Total received' : 'Total paid'}</span>
              <span>Rs {isSale ? totalReceived.toFixed(2) : totalPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-rose-600 dark:text-rose-300">
              <span>Due amount</span>
              <span>Rs {dueAmount.toFixed(2)}</span>
            </div>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
