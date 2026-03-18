import { create } from 'zustand';
import { api } from '../lib/api';

/**
 * Sales list store. Each page that needs sales calls fetch() with its own
 * params. The result is cached until invalidate() is called.
 */
export const useSaleStore = create((set, get) => ({
  sales: [],
  loading: false,
  loaded: false,
  error: null,

  fetch: async (params = {}, force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listSales(params);
      set({ sales: data || [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** Prepend a newly created sale so the list is immediately up-to-date. */
  prepend: (sale) =>
    set((state) => ({ sales: [sale, ...state.sales] })),

  /** Patch a sale in the local cache after an update. */
  patch: (id, data) =>
    set((state) => ({
      sales: state.sales.map((s) => (s.id === id ? { ...s, ...data } : s)),
    })),

  invalidate: () => set({ loaded: false }),
}));
