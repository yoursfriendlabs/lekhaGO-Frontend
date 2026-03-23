import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const useServiceStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'services',
    fetcher: (params) => api.listServices(params),
  }),

  prepend: (service) =>
    get().replaceCurrent((items) => [service, ...items]),

  patch: (id, data) =>
    get().replaceCurrent((items) =>
      items.map((item) => (item.id === id ? { ...item, ...data } : item))
    ),
}));
