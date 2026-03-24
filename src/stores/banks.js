import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const useBankStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'banks',
    allowParams: true,
    fetcher: (params) => api.listBanks(params),
  }),

  upsert: (bank) =>
    get().replaceCurrent((items) => {
      const exists = items.some((item) => item.id === bank.id);
      if (exists) {
        return items.map((item) => (item.id === bank.id ? { ...item, ...bank } : item));
      }

      return [bank, ...items];
    }),

  remove: (id) =>
    get().replaceCurrent((items) => items.filter((item) => item.id !== id)),
}));
