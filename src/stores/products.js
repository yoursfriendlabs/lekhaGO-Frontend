import { create } from 'zustand';
import { api } from '../lib/api';

/**
 * Global product cache. Fetches once per session; call invalidate() to force
 * a fresh load (e.g. after bulk import from the Products page).
 */
export const useProductStore = create((set, get) => ({
  products: [],
  loading: false,
  loaded: false,
  error: null,

  /** Load products. Skips the network call if already loaded unless force=true. */
  fetch: async (force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listProducts();
      set({ products: Array.isArray(data) ? data : [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** Prepend a newly created product without re-fetching. */
  addProduct: (product) =>
    set((state) => ({ products: [product, ...state.products] })),

  /** Mark cache stale so the next fetch() hits the server. */
  invalidate: () => set({ loaded: false }),
}));
