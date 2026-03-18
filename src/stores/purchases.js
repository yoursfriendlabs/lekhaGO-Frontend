  import { create } from 'zustand';
import { api } from '../lib/api';

export const usePurchaseStore = create((set, get) => ({
  purchases: [],
  loading: false,
  loaded: false,
  error: null,

  fetch: async (params = {}, force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listPurchases(params);
      set({ purchases: data || [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  prepend: (purchase) =>
    set((state) => ({ purchases: [purchase, ...state.purchases] })),

  patch: (id, data) =>
    set((state) => ({
      purchases: state.purchases.map((p) => (p.id === id ? { ...p, ...data } : p)),
    })),

  invalidate: () => set({ loaded: false }),
}));
