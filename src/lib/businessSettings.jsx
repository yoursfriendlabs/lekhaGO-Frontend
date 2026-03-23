import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { getBusinessId } from './storage';
import { useAuth } from './auth';

const CACHE_KEY = 'mms_biz_settings';

function cacheKey(businessId) {
  return `${CACHE_KEY}_${businessId || 'default'}`;
}

function readCache(businessId) {
  try {
    const raw = localStorage.getItem(cacheKey(businessId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(businessId, data) {
  try {
    localStorage.setItem(cacheKey(businessId), JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

const BusinessSettingsContext = createContext(null);

export function BusinessSettingsProvider({ children }) {
  const { businessId } = useAuth();
  // Start from cache so invoices render instantly on first paint
  const [settings, setSettings] = useState(() => readCache(getBusinessId()));
  const [loading, setLoading] = useState(false);

  const applySettings = useCallback((data, businessId) => {
    const cleaned = data || {};
    writeCache(businessId || getBusinessId(), cleaned);
    setSettings(cleaned);
  }, []);

  // Fetch from API and refresh cache
  const fetchSettings = useCallback(async (businessId) => {
    const bid = businessId || getBusinessId();
    if (!bid) return;
    setLoading(true);
    try {
      const data = await api.getBusinessSettings();
      applySettings(data, bid);
    } catch {
      // Non-critical — keep cached values, don't throw
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    const bid = businessId || getBusinessId();
    setSettings(readCache(bid));
    fetchSettings(bid);
  }, [businessId, fetchSettings]);

  // Save to API, then update cache + state
  const saveSettings = useCallback(async (data, businessId) => {
    const result = await api.updateBusinessSettings(data);
    applySettings(result ?? data, businessId || getBusinessId());
    return result;
  }, [applySettings]);

  // Call this when businessId changes (user switches business in Topbar)
  const reloadSettings = useCallback((nextBusinessId) => {
    const bid = nextBusinessId || businessId || getBusinessId();
    setSettings(readCache(bid));
    fetchSettings(bid);
  }, [businessId, fetchSettings]);

  return (
    <BusinessSettingsContext.Provider value={{ settings, loading, saveSettings, reloadSettings }}>
      {children}
    </BusinessSettingsContext.Provider>
  );
}

export function useBusinessSettings() {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) throw new Error('useBusinessSettings must be used within BusinessSettingsProvider');
  return ctx;
}
