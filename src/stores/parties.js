import { create } from 'zustand';
import { api } from '../lib/api';
import { createScopedListStoreSlice } from './createScopedListStore';

export const usePartyStore = create((set, get) => ({
  ...createScopedListStoreSlice(set, get, {
    resourceKey: 'parties',
    allowParams: false,
    fetcher: () => api.listParties(),
  }),

  /** Add a new party or replace an existing one by id. */
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
