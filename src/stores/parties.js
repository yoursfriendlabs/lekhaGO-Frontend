import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const usePartyStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'parties',
    allowParams: false,
    fetcher: () => api.listParties(),
  }),

<<<<<<< HEAD
  fetch: async (force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listParties();
      set({ parties: Array.isArray(data) ? data : [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** Add a new party or replace an existing one by id. */
=======
>>>>>>> f55843f25a5884d9ce49cd3ca06047dbc9732af7
  upsert: (party) =>
    get().replaceCurrent((items) => {
      const exists = items.some((item) => item.id === party.id);
      if (exists) {
        return items.map((item) => (item.id === party.id ? { ...item, ...party } : item));
      }

      return [party, ...items];
    }),

  remove: (id) =>
    get().replaceCurrent((items) => items.filter((item) => item.id !== id)),
}));
