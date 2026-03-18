import { createContext, useCallback, useContext, useState } from 'react';
import { getBusinessId } from './storage';

const SETTINGS_KEY = 'mms_biz_settings';

function storageKey(businessId) {
  return `${SETTINGS_KEY}_${businessId || 'default'}`;
}

export function loadBusinessSettings(businessId) {
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistBusinessSettings(businessId, data) {
  localStorage.setItem(storageKey(businessId), JSON.stringify(data));
}

const BusinessSettingsContext = createContext(null);

export function BusinessSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => loadBusinessSettings(getBusinessId()));

  const saveSettings = useCallback((data, businessId) => {
    const bid = businessId || getBusinessId();
    persistBusinessSettings(bid, data);
    setSettings({ ...data });
  }, []);

  const reloadSettings = useCallback((businessId) => {
    setSettings(loadBusinessSettings(businessId || getBusinessId()));
  }, []);

  return (
    <BusinessSettingsContext.Provider value={{ settings, saveSettings, reloadSettings }}>
      {children}
    </BusinessSettingsContext.Provider>
  );
}

export function useBusinessSettings() {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) throw new Error('useBusinessSettings must be used within BusinessSettingsProvider');
  return ctx;
}
