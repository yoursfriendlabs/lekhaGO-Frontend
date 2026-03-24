import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const usePurchaseStore = create((set, get) => ({
<<<<<<< HEAD
  purchases: [],
  loading: false,
  loaded: false,
  error: null,

  fetch: async (params = {}, force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listPurchases(params);
      set({ purchases: Array.isArray(data) ? data : [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
=======
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'purchases',
    fetcher: (params) => api.listPurchases(params),
  }),
>>>>>>> f55843f25a5884d9ce49cd3ca06047dbc9732af7

  prepend: (purchase) =>
    get().replaceCurrent((items) => [purchase, ...items]),

  patch: (id, data) =>
    get().replaceCurrent((items) =>
      items.map((item) => (item.id === id ? { ...item, ...data } : item))
    ),
}));
