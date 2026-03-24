import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const usePurchaseStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'purchases',
    fetcher: (params) => api.listPurchases(params),
  }),

  prepend: (purchase) =>
    get().replaceCurrent((items) => [purchase, ...items]),

  patch: (id, data) =>
    get().replaceCurrent((items) =>
      items.map((item) => (item.id === id ? { ...item, ...data } : item))
    ),
}));
