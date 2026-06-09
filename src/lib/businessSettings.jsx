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

function getBusinessDisplayName(business) {
  return business?.name || business?.businessName || '';
}

export function BusinessSettingsProvider({ children }) {
  const { businessId, business, businessProfile: authBusinessProfile } = useAuth();
  // Start from cache so invoices render instantly on first paint
  const [settings, setSettings] = useState(() => readCache(getBusinessId()));
  const [businessProfile, setBusinessProfile] = useState(() => readProfileCache(getBusinessId()));
  const [loading, setLoading] = useState(false);

  const applySettings = useCallback((data, businessId) => {
    const cleaned = data || {};
    const businessName = getBusinessDisplayName(business);
    const mergedSettings = !cleaned.companyName && businessName
      ? { ...cleaned, companyName: businessName }
      : cleaned;

    writeCache(businessId || getBusinessId(), mergedSettings);
    setSettings(mergedSettings);
  }, [business]);

  const mergeSettings = useCallback((updater, targetBusinessId) => {
    const bid = targetBusinessId || businessId || getBusinessId();
    setSettings((currentSettings) => {
      const nextSettings = typeof updater === 'function'
        ? updater(currentSettings || {})
        : { ...(currentSettings || {}), ...(updater || {}) };

      writeCache(bid, nextSettings);
      return nextSettings;
    });
  }, [businessId]);

  const applyBusinessProfile = useCallback((data, businessId) => {
    const normalized = normalizeBusinessProfile(data || null);
    writeProfileCache(businessId || getBusinessId(), normalized);
    setBusinessProfile(normalized);
  }, []);

  const syncBusinessName = useCallback((targetBusinessId, nextBusiness = business) => {
    const businessName = getBusinessDisplayName(nextBusiness);
    if (!businessName) return;

    mergeSettings((currentSettings) => ({ ...currentSettings, companyName: businessName }), targetBusinessId);
  }, [business, mergeSettings]);

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
    applySettings(readCache(bid), bid);
    setBusinessProfile(readProfileCache(bid) || authBusinessProfile || null);
    fetchSettings(bid);
  }, [applySettings, authBusinessProfile, businessId, fetchSettings]);

  useEffect(() => {
    if (!authBusinessProfile) return;
    const bid = businessId || getBusinessId();
    applyBusinessProfile(authBusinessProfile, bid);
  }, [applyBusinessProfile, authBusinessProfile, businessId]);

  useEffect(() => {
    if (!business) return;
    syncBusinessName(businessId || getBusinessId(), business);
  }, [business, businessId, syncBusinessName]);

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
    applySettings(readCache(bid), bid);
    setBusinessProfile(readProfileCache(bid) || authBusinessProfile || null);
    fetchSettings(bid);
  }, [applySettings, authBusinessProfile, businessId, fetchSettings]);

  return (
    <BusinessSettingsContext value={{ settings, businessProfile, loading, saveSettings, reloadSettings, mergeSettings, syncBusinessName }}>
      {children}
    </BusinessSettingsContext>
  );
}

export function useBusinessSettings() {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) throw new Error('useBusinessSettings must be used within BusinessSettingsProvider');
  return ctx;
}
