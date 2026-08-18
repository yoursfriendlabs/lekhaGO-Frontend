export const COLOR_THEME_STORAGE_KEY = 'mms_color_theme';
export const DEFAULT_COLOR_THEME_ID = 'teak';

export const COLOR_THEMES = [
  {
    id: 'teak',
    swatch: '#9b6835',
    labelKey: 'theme.names.teak',
    hintKey: 'theme.hints.teak',
    colors: {
      primary: {
        DEFAULT: '#9b6835',
        50: '#fcfaf8',
        100: '#f7f2ed',
        200: '#ede0d1',
        300: '#dec7af',
        400: '#c7a382',
        500: '#9b6835',
        600: '#8c5e30',
        700: '#754e28',
        800: '#5e3e20',
        900: '#4d331a',
      },
      secondary: {
        DEFAULT: '#a57749',
        50: '#fbf9f7',
        100: '#f6f1ec',
        200: '#e9dbcf',
        300: '#d7bcab',
        400: '#bc9680',
        500: '#a57749',
        600: '#956b42',
        700: '#7c5937',
        800: '#63472c',
        900: '#513a24',
      },
      ink: '#1a140f',
      inkLight: '#4d331a',
      mist: '#f7f2ed',
      surface: '#ffffff',
    },
  },
  {
    id: 'teal',
    swatch: '#0f766e',
    labelKey: 'theme.names.teal',
    hintKey: 'theme.hints.teal',
    colors: {
      primary: {
        DEFAULT: '#0f766e',
        50: '#f0fdfa',
        100: '#ccfbf1',
        200: '#99f6e4',
        300: '#5eead4',
        400: '#2dd4bf',
        500: '#0f766e',
        600: '#0d6b64',
        700: '#115e59',
        800: '#134e4a',
        900: '#042f2e',
      },
      secondary: {
        DEFAULT: '#527a75',
        50: '#f4f8f7',
        100: '#e7f0ee',
        200: '#cde0dc',
        300: '#a5c4bf',
        400: '#739e99',
        500: '#527a75',
        600: '#446662',
        700: '#36524f',
        800: '#2a403e',
        900: '#1f302e',
      },
      ink: '#0f172a',
      inkLight: '#334155',
      mist: '#f0fdfa',
      surface: '#ffffff',
    },
  },
  {
    id: 'indigo',
    swatch: '#4338ca',
    labelKey: 'theme.names.indigo',
    hintKey: 'theme.hints.indigo',
    colors: {
      primary: {
        DEFAULT: '#4338ca',
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#4338ca',
        600: '#3730a3',
        700: '#312e81',
        800: '#1e1b4b',
        900: '#141232',
      },
      secondary: {
        DEFAULT: '#6366f1',
        50: '#f5f7ff',
        100: '#eef0ff',
        200: '#dcdffc',
        300: '#c3c7f5',
        400: '#9ea3e8',
        500: '#6366f1',
        600: '#4f52c9',
        700: '#3f429e',
        800: '#32357c',
        900: '#282a63',
      },
      ink: '#0f172a',
      inkLight: '#334155',
      mist: '#eef2ff',
      surface: '#ffffff',
    },
  },
  {
    id: 'forest',
    swatch: '#047857',
    labelKey: 'theme.names.forest',
    hintKey: 'theme.hints.forest',
    colors: {
      primary: {
        DEFAULT: '#047857',
        50: '#ecfdf5',
        100: '#d1fae5',
        200: '#a7f3d0',
        300: '#6ee7b7',
        400: '#34d399',
        500: '#047857',
        600: '#05664b',
        700: '#064e3b',
        800: '#064030',
        900: '#022c22',
      },
      secondary: {
        DEFAULT: '#3f7a63',
        50: '#f3f8f5',
        100: '#e6f1eb',
        200: '#c9e0d3',
        300: '#9fc4b0',
        400: '#6fa08a',
        500: '#3f7a63',
        600: '#356a55',
        700: '#2b5646',
        800: '#224438',
        900: '#1a342b',
      },
      ink: '#14241c',
      inkLight: '#365347',
      mist: '#f0fdf4',
      surface: '#ffffff',
    },
  },
  {
    id: 'ruby',
    swatch: '#be123c',
    labelKey: 'theme.names.ruby',
    hintKey: 'theme.hints.ruby',
    colors: {
      primary: {
        DEFAULT: '#be123c',
        50: '#fff1f2',
        100: '#ffe4e6',
        200: '#fecdd3',
        300: '#fda4af',
        400: '#fb7185',
        500: '#be123c',
        600: '#9f1239',
        700: '#881337',
        800: '#4c0519',
        900: '#400716',
      },
      secondary: {
        DEFAULT: '#9f4b5c',
        50: '#fdf7f8',
        100: '#f8ecee',
        200: '#efd5da',
        300: '#ddb0b8',
        400: '#c17d8a',
        500: '#9f4b5c',
        600: '#8c4151',
        700: '#733543',
        800: '#5c2b36',
        900: '#4b232c',
      },
      ink: '#1e0f12',
      inkLight: '#5c2432',
      mist: '#fff1f2',
      surface: '#ffffff',
    },
  },
];

export const CUSTOM_COLOR_THEME_ID = 'custom';
export const CUSTOM_PRIMARY_STORAGE_KEY = 'mms_custom_primary';

/** Stable greys/blacks so copy and tables stay readable on every primary. */
export const NEUTRAL_COLORS = {
  secondary: {
    DEFAULT: '#6b7280',
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  ink: '#111827',
  inkLight: '#4b5563',
  surface: '#ffffff',
};

export function parseHexColor(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return '';

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex.split('').map((character) => `${character}${character}`).join('');
  }

  return `#${hex.toLowerCase()}`;
}

export function hexToRgbChannels(hex) {
  const normalized = parseHexColor(hex).replace('#', '');
  if (!normalized) return '';

  const value = Number.parseInt(normalized, 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

function hexToRgb(hex) {
  const channels = hexToRgbChannels(hex).split(' ').map(Number);
  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) return null;
  return { r: channels[0], g: channels[1], b: channels[2] };
}

function rgbToHex({ r, g, b }) {
  const toHex = (channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;

  return { h: hue * 360, s: saturation * 100, l: lightness * 100 };
}

function hueToRgb(p, q, t) {
  let tone = t;
  if (tone < 0) tone += 1;
  if (tone > 1) tone -= 1;
  if (tone < 1 / 6) return p + (q - p) * 6 * tone;
  if (tone < 1 / 2) return q;
  if (tone < 2 / 3) return p + (q - p) * (2 / 3 - tone) * 6;
  return p;
}

function hslToRgb({ h, s, l }) {
  const hue = ((h % 360) + 360) % 360 / 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;

  if (saturation === 0) {
    const value = lightness * 255;
    return { r: value, g: value, b: value };
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    r: hueToRgb(p, q, hue + 1 / 3) * 255,
    g: hueToRgb(p, q, hue) * 255,
    b: hueToRgb(p, q, hue - 1 / 3) * 255,
  };
}

function relativeLuminance({ r, g, b }) {
  const toLinear = (channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastAgainstWhite(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const luminance = relativeLuminance(rgb);
  return (1.05) / (luminance + 0.05);
}

function shade(hsl, lightness, saturation = hsl.s) {
  return rgbToHex(hslToRgb({
    h: hsl.h,
    s: Math.max(0, Math.min(100, saturation)),
    l: Math.max(0, Math.min(100, lightness)),
  }));
}

export function ensureReadablePrimary(hex) {
  const parsed = parseHexColor(hex);
  if (!parsed) return '';

  let current = parsed;
  let hsl = rgbToHsl(hexToRgb(current));
  while (contrastAgainstWhite(current) < 4.5 && hsl.l > 26) {
    hsl = { ...hsl, l: hsl.l - 2 };
    current = shade(hsl, hsl.l);
  }
  return current;
}

export function buildPaletteFromHex(value) {
  const sourceHex = parseHexColor(value);
  if (!sourceHex) return null;

  const baseHsl = rgbToHsl(hexToRgb(sourceHex));
  const buttonHex = ensureReadablePrimary(sourceHex);
  const buttonHsl = rgbToHsl(hexToRgb(buttonHex));
  const sat = Math.min(100, Math.max(22, baseHsl.s));

  return {
    id: CUSTOM_COLOR_THEME_ID,
    swatch: buttonHex,
    sourceHex,
    labelKey: 'theme.names.custom',
    hintKey: 'theme.hints.custom',
    colors: {
      primary: {
        DEFAULT: buttonHex,
        50: shade(baseHsl, 97.4, Math.min(sat, 32)),
        100: shade(baseHsl, 93.5, Math.min(sat, 38)),
        200: shade(baseHsl, 86, Math.min(sat, 48)),
        300: shade(baseHsl, 74, Math.min(sat, 56)),
        400: shade(baseHsl, 62, sat),
        500: buttonHex,
        600: shade(buttonHsl, Math.max(20, buttonHsl.l - 8)),
        700: shade(buttonHsl, Math.max(16, buttonHsl.l - 16)),
        800: shade(buttonHsl, Math.max(13, buttonHsl.l - 24)),
        900: shade(buttonHsl, Math.max(10, buttonHsl.l - 32), Math.min(100, buttonHsl.s + 6)),
      },
      ...NEUTRAL_COLORS,
      mist: shade(baseHsl, 97.2, Math.min(28, sat)),
    },
  };
}

export function findPresetThemeByHex(value) {
  const hex = parseHexColor(value);
  if (!hex) return null;
  return COLOR_THEMES.find((theme) => theme.swatch.toLowerCase() === hex) || null;
}

export function normalizeColorThemeId(value) {
  const id = String(value || '').trim();
  if (id === CUSTOM_COLOR_THEME_ID) return CUSTOM_COLOR_THEME_ID;
  return COLOR_THEMES.some((theme) => theme.id === id) ? id : DEFAULT_COLOR_THEME_ID;
}

export function getColorTheme(id = DEFAULT_COLOR_THEME_ID, customHex = '') {
  const normalized = normalizeColorThemeId(id);
  if (normalized === CUSTOM_COLOR_THEME_ID) {
    return buildPaletteFromHex(customHex) || COLOR_THEMES[0];
  }
  return COLOR_THEMES.find((theme) => theme.id === normalized) || COLOR_THEMES[0];
}

export function readStoredColorTheme() {
  try {
    const id = normalizeColorThemeId(window.localStorage.getItem(COLOR_THEME_STORAGE_KEY));
    const customHex = parseHexColor(window.localStorage.getItem(CUSTOM_PRIMARY_STORAGE_KEY));
    if (id === CUSTOM_COLOR_THEME_ID && !customHex) {
      return { id: DEFAULT_COLOR_THEME_ID, customHex: '' };
    }
    return { id, customHex };
  } catch {
    return { id: DEFAULT_COLOR_THEME_ID, customHex: '' };
  }
}

export function readStoredColorThemeId() {
  return readStoredColorTheme().id;
}

export function persistColorTheme(id, customHex = '') {
  const nextId = normalizeColorThemeId(id);
  const parsedHex = parseHexColor(customHex);
  try {
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, nextId);
    if (parsedHex) window.localStorage.setItem(CUSTOM_PRIMARY_STORAGE_KEY, parsedHex);
  } catch {
    // Ignore private-mode / blocked storage.
  }
  return { id: nextId, customHex: parsedHex };
}

export function persistColorThemeId(id) {
  return persistColorTheme(id).id;
}

export function applyColorTheme(id = DEFAULT_COLOR_THEME_ID, customHex = '') {
  if (typeof document === 'undefined') return getColorTheme(id, customHex);

  const theme = getColorTheme(id, customHex);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  root.style.colorScheme = 'light';

  const setVar = (name, hex) => {
    const channels = hexToRgbChannels(hex);
    if (channels) root.style.setProperty(name, channels);
  };

  Object.entries(theme.colors.primary).forEach(([shade, hex]) => {
    const suffix = shade === 'DEFAULT' ? '' : `-${shade}`;
    setVar(`--color-primary${suffix}`, hex);
  });

  Object.entries(NEUTRAL_COLORS.secondary).forEach(([shade, hex]) => {
    const suffix = shade === 'DEFAULT' ? '' : `-${shade}`;
    setVar(`--color-secondary${suffix}`, hex);
  });

  setVar('--color-ink', NEUTRAL_COLORS.ink);
  setVar('--color-ink-light', NEUTRAL_COLORS.inkLight);
  setVar('--color-mist', theme.colors.mist);
  setVar('--color-surface', NEUTRAL_COLORS.surface);
  root.style.setProperty('--color-primary-hex', theme.swatch);

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.swatch);

  return theme;
}

export function getThemeChartColor(fallback = COLOR_THEMES[0].swatch) {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue('--color-primary-hex').trim() || fallback;
}
