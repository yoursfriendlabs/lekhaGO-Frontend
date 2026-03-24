import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const useServiceStore = create((set, get) => ({
<<<<<<< HEAD
  services: [],
  loading: false,
  loaded: false,
  error: null,

  fetch: async (params = {}, force = false) => {
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const data = await api.listServices(params);
      set({ services: Array.isArray(data) ? data : [], loaded: true, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
=======
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'services',
    fetcher: (params) => api.listServices(params),
  }),
>>>>>>> f55843f25a5884d9ce49cd3ca06047dbc9732af7

  prepend: (service) =>
    get().replaceCurrent((items) => [service, ...items]),

  patch: (id, data) =>
    get().replaceCurrent((items) =>
      items.map((item) => (item.id === id ? { ...item, ...data } : item))
    ),
}));
