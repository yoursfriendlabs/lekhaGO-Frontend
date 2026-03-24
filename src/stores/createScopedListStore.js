import { getBusinessId } from '../lib/storage';
import { getCollectionItems } from '../lib/api';
import { toScopedQueryKey } from '../lib/queryKey';

function getScopeKey() {
  return getBusinessId() || 'default';
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeFetchArgs(paramsOrForce, maybeForce, allowParams) {
  if (!allowParams) {
    return {
      params: {},
      force: Boolean(paramsOrForce),
    };
  }

  if (typeof paramsOrForce === 'boolean') {
    return {
      params: {},
      force: paramsOrForce,
    };
  }

  return {
    params: paramsOrForce || {},
    force: Boolean(maybeForce),
  };
}

export function createScopedListStoreSlice(set, get, { resourceKey, fetcher, allowParams = true }) {
  return {
    [resourceKey]: [],
    loading: false,
    loaded: false,
    error: null,
    total: 0,
    currentKey: '',
    currentScope: getScopeKey(),
    lists: {},

    fetch: async (paramsOrForce = allowParams ? {} : false, maybeForce = false) => {
      const { params, force } = normalizeFetchArgs(paramsOrForce, maybeForce, allowParams);
      const scopeKey = getScopeKey();
      const key = toScopedQueryKey(scopeKey, params);
      const state = get();
      const cachedEntry = state.lists[key];
      const scopeChanged = state.currentScope !== scopeKey;

      if (scopeChanged && !cachedEntry) {
        set({
          currentScope: scopeKey,
          currentKey: key,
          [resourceKey]: [],
          loaded: false,
          loading: false,
          error: null,
          total: 0,
        });
      }

      if (cachedEntry?.loaded && !force) {
        if (state.currentKey !== key || scopeChanged) {
          const cachedItems = ensureArray(cachedEntry.items);
          set({
            currentScope: scopeKey,
            currentKey: key,
            [resourceKey]: cachedItems,
            total: cachedEntry.total ?? cachedItems.length,
            loaded: true,
            loading: false,
            error: null,
          });
        }

        return ensureArray(cachedEntry.items);
      }

      if (cachedEntry?.loading && cachedEntry.promise) {
        if (state.currentKey !== key || scopeChanged) {
          const cachedItems = ensureArray(cachedEntry.items);
          set({
            currentScope: scopeKey,
            currentKey: key,
            [resourceKey]: cachedItems,
            total: cachedEntry.total ?? cachedItems.length,
            loaded: Boolean(cachedEntry.loaded),
            loading: true,
            error: null,
          });
        }

        return cachedEntry.promise;
      }

      const request = Promise.resolve(fetcher(params, { force }))
        .then((data) => {
          const items = ensureArray(getCollectionItems(data));
          const total = Number(data?.total ?? items.length);
          const limit = Number(data?.limit ?? items.length);
          const offset = Number(data?.offset ?? 0);

          set((currentState) => ({
            lists: {
              ...currentState.lists,
              [key]: {
                items,
                total,
                limit,
                offset,
                params,
                loaded: true,
                loading: false,
                error: null,
                promise: null,
                lastFetchedAt: Date.now(),
              },
            },
            currentScope: scopeKey,
            currentKey: key,
            [resourceKey]: items,
            total,
            loaded: true,
            loading: false,
            error: null,
          }));

          return items;
        })
        .catch((error) => {
          const cachedItems = ensureArray(cachedEntry?.items);
          set((currentState) => ({
            lists: {
              ...currentState.lists,
              [key]: {
                items: cachedItems,
                total: cachedEntry?.total ?? 0,
                limit: cachedEntry?.limit ?? 0,
                offset: cachedEntry?.offset ?? 0,
                params,
                loaded: false,
                loading: false,
                error: error.message,
                promise: null,
                lastFetchedAt: cachedEntry?.lastFetchedAt || 0,
              },
            },
            currentScope: scopeKey,
            currentKey: key,
            [resourceKey]: cachedItems,
            total: cachedEntry?.total ?? 0,
            loaded: Boolean(cachedEntry?.loaded),
            loading: false,
            error: error.message,
          }));

          throw error;
        });

      set((currentState) => {
        const cachedItems = ensureArray(cachedEntry?.items);

        return {
          lists: {
            ...currentState.lists,
            [key]: {
              items: cachedItems,
              total: cachedEntry?.total ?? 0,
              limit: cachedEntry?.limit ?? 0,
              offset: cachedEntry?.offset ?? 0,
              params,
              loaded: Boolean(cachedEntry?.loaded),
              loading: true,
              error: null,
              promise: request,
              lastFetchedAt: cachedEntry?.lastFetchedAt || 0,
            },
          },
          currentScope: scopeKey,
          currentKey: key,
          [resourceKey]: cachedItems,
          total: cachedEntry?.total ?? 0,
          loaded: Boolean(cachedEntry?.loaded),
          loading: true,
          error: null,
        };
      });

      return request;
    },

    replaceCurrent: (updater) => {
      const currentKey = get().currentKey;
      if (!currentKey) return;

      set((state) => {
        const currentEntry = state.lists[currentKey];
        const currentItems = ensureArray(currentEntry?.items ?? state[resourceKey]);
        const nextItems = ensureArray(updater(currentItems));

        return {
          lists: {
            ...state.lists,
            [currentKey]: {
              ...(currentEntry || {}),
              items: nextItems,
              total: currentEntry?.total ?? nextItems.length,
              loaded: true,
              error: null,
            },
          },
          [resourceKey]: nextItems,
          total: currentEntry?.total ?? nextItems.length,
          loaded: true,
          error: null,
        };
      });
    },

    invalidate: (params) => {
      const scopeKey = getScopeKey();
      const targetKey = params ? toScopedQueryKey(scopeKey, params) : null;

      set((state) => {
        const nextLists = { ...state.lists };
        const keysToInvalidate = targetKey
          ? [targetKey]
          : Object.keys(nextLists).filter((key) => key.startsWith(`${scopeKey}:`));

        keysToInvalidate.forEach((key) => {
          if (!nextLists[key]) return;
          nextLists[key] = {
            ...nextLists[key],
            loaded: false,
            promise: null,
          };
        });

        return {
          lists: nextLists,
          loaded: targetKey && state.currentKey !== targetKey ? state.loaded : false,
        };
      });
    },
  };
}
