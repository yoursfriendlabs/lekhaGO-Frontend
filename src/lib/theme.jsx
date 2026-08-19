import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  COLOR_THEMES,
  CUSTOM_COLOR_THEME_ID,
  applyColorTheme,
  findPresetThemeByHex,
  getColorTheme,
  parseHexColor,
  persistColorTheme,
  readStoredColorTheme,
} from './themes';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(() => {
    if (typeof window === 'undefined') return 'teak';
    const stored = readStoredColorTheme();
    applyColorTheme(stored.id, stored.customHex);
    return stored.id;
  });
  const [customHex, setCustomHexState] = useState(() => {
    if (typeof window === 'undefined') return '';
    return readStoredColorTheme().customHex;
  });

  useEffect(() => {
    applyColorTheme(themeId, customHex);
  }, [customHex, themeId]);

  const setThemeId = useCallback((nextId, nextHex = customHex) => {
    const stored = persistColorTheme(nextId, nextHex);
    applyColorTheme(stored.id, stored.customHex);
    setThemeIdState(stored.id);
    if (stored.customHex) setCustomHexState(stored.customHex);
  }, [customHex]);

  const setCustomColor = useCallback((rawHex) => {
    const parsed = parseHexColor(rawHex);
    if (!parsed) return false;

    const preset = findPresetThemeByHex(parsed);
    const nextId = preset?.id || CUSTOM_COLOR_THEME_ID;
    const stored = persistColorTheme(nextId, parsed);
    applyColorTheme(stored.id, stored.customHex);
    setThemeIdState(stored.id);
    setCustomHexState(stored.customHex);
    return true;
  }, []);

  const colorTheme = useMemo(() => getColorTheme(themeId, customHex), [customHex, themeId]);

  const value = useMemo(() => ({
    theme: 'light',
    themeId,
    customHex,
    colorTheme,
    themes: COLOR_THEMES,
    setThemeId,
    setTheme: setThemeId,
    setCustomColor,
  }), [colorTheme, customHex, setCustomColor, setThemeId, themeId]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
