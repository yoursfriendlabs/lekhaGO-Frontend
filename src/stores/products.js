import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const useProductStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'products',
    allowParams: false,
    fetcher: () => api.listProducts(),
  }),

  /** Prepend a newly created product without re-fetching. */
  addProduct: (product) =>
    get().replaceCurrent((items) => [product, ...items]),

  patchProduct: (id, data) =>
    get().replaceCurrent((items) =>
      items.map((item) => (item.id === id ? { ...item, ...data } : item))
    ),
}));
