import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const useProductStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'products',
    allowParams: false,
    fetcher: () => api.listProducts(),
  }),

<<<<<<< HEAD
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
=======
>>>>>>> f55843f25a5884d9ce49cd3ca06047dbc9732af7
  addProduct: (product) =>
    get().replaceCurrent((items) => [product, ...items]),
}));
