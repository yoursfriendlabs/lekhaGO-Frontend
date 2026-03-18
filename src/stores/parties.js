import { create } from 'zustand';
import { api } from '../lib/api';

/**
 * Global party cache. Fetches all parties once per session.
 * Pages filter by type / query client-side — suitable for small/medium shops.
 */
export const usePartyStore = create((set, get) => ({
  parties: [],
  loading: false,
  loaded: false,
  error: null,

  fetch: async (force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listParties();
      set({ parties: data || [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** Add a new party or replace an existing one by id. */
  upsert: (party) =>
    set((state) => {
      const exists = state.parties.some((p) => p.id === party.id);
      return {
        parties: exists
          ? state.parties.map((p) => (p.id === party.id ? { ...p, ...party } : p))
          : [party, ...state.parties],
      };
    }),

  remove: (id) =>
    set((state) => ({ parties: state.parties.filter((p) => p.id !== id) })),

  invalidate: () => set({ loaded: false }),
}));
