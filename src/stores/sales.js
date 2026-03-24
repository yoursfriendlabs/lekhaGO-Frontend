import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const useSaleStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'sales',
    fetcher: (params) => api.listSales(params),
  }),

  prepend: (sale) =>
    get().replaceCurrent((items) => [sale, ...items]),

  patch: (id, data) =>
    get().replaceCurrent((items) =>
      items.map((item) => (item.id === id ? { ...item, ...data } : item))
    ),
}));
