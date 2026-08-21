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
  if (params.stock !== 'low') return api.listProducts(params);

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
