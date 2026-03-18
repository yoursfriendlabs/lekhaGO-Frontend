import { create } from 'zustand';
import { api } from '../lib/api';

export const useServiceStore = create((set, get) => ({
  services: [],
  loading: false,
  loaded: false,
  error: null,

  fetch: async (params = {}, force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listServices(params);
      set({ services: data || [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  prepend: (service) =>
    set((state) => ({ services: [service, ...state.services] })),

  patch: (id, data) =>
    set((state) => ({
      services: state.services.map((s) => (s.id === id ? { ...s, ...data } : s)),
    })),

  invalidate: () => set({ loaded: false }),
}));
