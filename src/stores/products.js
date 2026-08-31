import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

// The backend's `stock=low` filter only covers items with 0 < stock <= the
// low-stock threshold. Items with stock 0 (out of stock) are even more
// critical, so the low-stock view merges the `stock=low` and `stock=out`
// lists. A large limit is used because the merged list is paginated
// client-side in the Inventory page.
const LOW_STOCK_FETCH_LIMIT = 1000;

async function fetchProducts(params = {}) {
  if (params.stock === 'low') {
    const [lowRes, outRes] = await Promise.all([
      api.listProducts({ ...params, stock: 'low', limit: LOW_STOCK_FETCH_LIMIT, offset: 0 }),
      api.listProducts({ ...params, stock: 'out', limit: LOW_STOCK_FETCH_LIMIT, offset: 0 }),
    ]);

    return {
      ...lowRes,
      items: [...(lowRes?.items || []), ...(outRes?.items || [])],
      total: Number(lowRes?.total ?? 0) + Number(outRes?.total ?? 0),
    };
  }

  if (params.stock === 'unsold' || params.sort === 'leastPopular') {
    const { stock: _stock, sort: _sort, limit, offset, ...restParams } = params;
    const [allProductsRes, popularRes, salesRes, servicesRes] = await Promise.all([
      api.listProducts({ ...restParams, limit: LOW_STOCK_FETCH_LIMIT, offset: 0 }).catch(() => null),
      api.getPopularItemsAnalytics({ limit: 1000 }).catch(() => null),
      api.listSales({ limit: 1000 }).catch(() => null),
      api.listServices({ limit: 1000 }).catch(() => null),
    ]);

    const soldQuantities = new Map();

    (popularRes?.items || []).forEach((item) => {
      const pid = String(item?.productId || item?.id || '');
      if (pid) {
        const qty = Number(item.totalQuantity || item.saleQuantity || item.orderCount || 0);
        soldQuantities.set(pid, Math.max(soldQuantities.get(pid) || 0, qty));
      }
    });

    const salesList = Array.isArray(salesRes?.items)
      ? salesRes.items
      : Array.isArray(salesRes)
        ? salesRes
        : [];
    salesList.forEach((sale) => {
      const saleItems = Array.isArray(sale?.SaleItems)
        ? sale.SaleItems
        : Array.isArray(sale?.items)
          ? sale.items
          : Array.isArray(sale?.saleItems)
            ? sale.saleItems
            : [];
      saleItems.forEach((item) => {
        const pid = String(item?.productId || item?.ProductId || item?.product?.id || item?.Product?.id || '');
        if (pid) {
          const qty = Number(item?.quantity || 1);
          soldQuantities.set(pid, (soldQuantities.get(pid) || 0) + qty);
        }
      });
    });

    const servicesList = Array.isArray(servicesRes?.items)
      ? servicesRes.items
      : Array.isArray(servicesRes)
        ? servicesRes
        : [];
    servicesList.forEach((srv) => {
      const srvItems = Array.isArray(srv?.ServiceItems)
        ? srv.ServiceItems
        : Array.isArray(srv?.items)
          ? srv.items
          : Array.isArray(srv?.serviceItems)
            ? srv.serviceItems
            : [];
      srvItems.forEach((item) => {
        const pid = String(item?.productId || item?.ProductId || item?.product?.id || item?.Product?.id || '');
        if (pid) {
          const qty = Number(item?.quantity || 1);
          soldQuantities.set(pid, (soldQuantities.get(pid) || 0) + qty);
        }
      });
    });

    const allItems = Array.isArray(allProductsRes?.items)
      ? allProductsRes.items
      : Array.isArray(allProductsRes?.data)
        ? allProductsRes.data
        : Array.isArray(allProductsRes?.products)
          ? allProductsRes.products
          : Array.isArray(allProductsRes)
            ? allProductsRes
            : [];

    let filteredItems = allItems;

    if (params.stock === 'unsold') {
      const unsoldList = allItems.filter((p) => {
        const pid = String(p.id || p._id || '');
        return (soldQuantities.get(pid) || 0) === 0;
      });
      if (unsoldList.length > 0 || soldQuantities.size === 0) {
        filteredItems = unsoldList;
      } else {
        const quantities = allItems.map((p) => soldQuantities.get(String(p.id || p._id || '')) || 0);
        const minQty = Math.min(...quantities);
        filteredItems = allItems.filter((p) => (soldQuantities.get(String(p.id || p._id || '')) || 0) <= minQty);
      }
    }

    if (params.sort === 'leastPopular') {
      filteredItems = [...filteredItems].sort((a, b) => {
        const aSold = soldQuantities.get(String(a.id || a._id || '')) || 0;
        const bSold = soldQuantities.get(String(b.id || b._id || '')) || 0;
        if (aSold !== bSold) return aSold - bSold;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }

    const numericOffset = Number(offset || 0);
    const numericLimit = Number(limit || 50);
    const pagedItems = filteredItems.slice(numericOffset, numericOffset + numericLimit);

    return {
      items: pagedItems,
      total: filteredItems.length,
      limit: numericLimit,
      offset: numericOffset,
    };
  }

  return api.listProducts(params);
}

export const useProductStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'products',
    allowParams: true,
    fetcher: fetchProducts,
  }),

  /** Prepend a newly created product without re-fetching. */
  addProduct: (product) =>
    get().replaceCurrent((items) => [product, ...items]),

  patchProduct: (id, data) =>
    get().replaceCurrent((items) =>
      items.map((item) => (item.id === id ? { ...item, ...data } : item))
    ),
}));
