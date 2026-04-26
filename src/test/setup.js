import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

function createStorageMock() {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] || null,
    get length() {
      return store.size;
    },
  };
}

function getStorage(name) {
  const storage = window[name];
  if (storage && typeof storage.clear === 'function') return storage;

  const mockStorage = createStorageMock();
  Object.defineProperty(window, name, {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
  return mockStorage;
}

beforeEach(() => {
  getStorage('localStorage').clear();
  getStorage('sessionStorage').clear();
});

afterEach(() => {
  cleanup();
  getStorage('localStorage').clear();
  getStorage('sessionStorage').clear();
});
