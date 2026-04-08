import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { getBusinessId } from './storage';
import { useAuth } from './auth';
import { normalizeBusinessProfile } from './businessProfile';

const CACHE_KEY = 'mms_biz_settings';
const PROFILE_CACHE_KEY = 'mms_biz_profile';

function cacheKey(businessId) {
  return `${CACHE_KEY}_${businessId || 'default'}`;
}

function profileCacheKey(businessId) {
  return `${PROFILE_CACHE_KEY}_${businessId || 'default'}`;
}

function readCache(businessId) {
  try {
    const raw = localStorage.getItem(cacheKey(businessId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readProfileCache(businessId) {
  try {
    const raw = localStorage.getItem(profileCacheKey(businessId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(businessId, data) {
  try {
    localStorage.setItem(cacheKey(businessId), JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

function writeProfileCache(businessId, data) {
  try {
    localStorage.setItem(profileCacheKey(businessId), JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

const BusinessSettingsContext = createContext(null);

export function BusinessSettingsProvider({ children }) {
  const { businessId } = useAuth();
  // Start from cache so invoices render instantly on first paint
  const [settings, setSettings] = useState(() => readCache(getBusinessId()));
  const [businessProfile, setBusinessProfile] = useState(() => readProfileCache(getBusinessId()));
  const [loading, setLoading] = useState(false);

  const applySettings = useCallback((data, businessId) => {
    const cleaned = data || {};
    writeCache(businessId || getBusinessId(), cleaned);
    setSettings(cleaned);
  }, []);

  const applyBusinessProfile = useCallback((data, businessId) => {
    const normalized = normalizeBusinessProfile(data || null);
    writeProfileCache(businessId || getBusinessId(), normalized);
    setBusinessProfile(normalized);
  }, []);

  // Fetch from API and refresh cache
  const fetchSettings = useCallback(async (businessId) => {
    const bid = businessId || getBusinessId();
    if (!bid) {
      setBusinessProfile(null);
      return;
    }
    setLoading(true);
    try {
      const [settingsData, profileData] = await Promise.all([
        api.getBusinessSettings(),
        api.getBusinessProfile(),
      ]);
      applySettings(settingsData, bid);
      applyBusinessProfile(profileData, bid);
    } catch {
      // Non-critical — keep cached values, don't throw
    } finally {
      setLoading(false);
    }
  }, [applyBusinessProfile, applySettings]);

  useEffect(() => {
    const bid = businessId || getBusinessId();
    setSettings(readCache(bid));
    setBusinessProfile(readProfileCache(bid));
    fetchSettings(bid);
  }, [businessId, fetchSettings]);

  // Save to API, then update cache + state
  const saveSettings = useCallback(async (data, businessId) => {
    const result = await api.updateBusinessSettings(data);
    applySettings(result ?? data, businessId || getBusinessId());
    const profile = await api.getBusinessProfile();
    applyBusinessProfile(profile, businessId || getBusinessId());
    return result;
  }, [applyBusinessProfile, applySettings]);

  // Call this when businessId changes (user switches business in Topbar)
  const reloadSettings = useCallback((nextBusinessId) => {
    const bid = nextBusinessId || businessId || getBusinessId();
    setSettings(readCache(bid));
    setBusinessProfile(readProfileCache(bid));
    fetchSettings(bid);
  }, [businessId, fetchSettings]);

  return (
    <BusinessSettingsContext.Provider value={{ settings, businessProfile, loading, saveSettings, reloadSettings }}>
      {children}
    </BusinessSettingsContext.Provider>
  );
}

export function useBusinessSettings() {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) throw new Error('useBusinessSettings must be used within BusinessSettingsProvider');
  return ctx;
}
