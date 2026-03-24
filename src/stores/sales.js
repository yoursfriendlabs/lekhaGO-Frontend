import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const useSaleStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'sales',
    fetcher: (params) => api.listSales(params),
  }),

<<<<<<< HEAD
  fetch: async (params = {}, force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listSales(params);
      set({ sales: Array.isArray(data) ? data : [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** Prepend a newly created sale so the list is immediately up-to-date. */
=======
>>>>>>> f55843f25a5884d9ce49cd3ca06047dbc9732af7
  prepend: (sale) =>
    get().replaceCurrent((items) => [sale, ...items]),

  patch: (id, data) =>
    get().replaceCurrent((items) =>
      items.map((item) => (item.id === id ? { ...item, ...data } : item))
    ),
}));
