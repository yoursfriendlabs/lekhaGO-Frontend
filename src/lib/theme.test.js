import {
  applyColorTheme,
  buildPaletteFromHex,
  COLOR_THEMES,
  CUSTOM_COLOR_THEME_ID,
  DEFAULT_COLOR_THEME_ID,
  ensureReadablePrimary,
  getColorTheme,
  hexToRgbChannels,
  normalizeColorThemeId,
  parseHexColor,
} from './themes';

describe('color themes', () => {
  it('exposes five selectable palettes', () => {
    expect(COLOR_THEMES).toHaveLength(5);
    expect(COLOR_THEMES.map((theme) => theme.id)).toEqual([
      'teak',
      'teal',
      'indigo',
      'forest',
      'ruby',
    ]);
  });

  it('normalizes unknown ids to the default teak theme', () => {
    expect(normalizeColorThemeId('unknown')).toBe(DEFAULT_COLOR_THEME_ID);
    expect(normalizeColorThemeId(CUSTOM_COLOR_THEME_ID)).toBe(CUSTOM_COLOR_THEME_ID);
    expect(getColorTheme('teal').swatch).toBe('#0f766e');
  });

  it('parses pasted hex values with or without a hash', () => {
    expect(parseHexColor('#9b6835')).toBe('#9b6835');
    expect(parseHexColor('1a73e8')).toBe('#1a73e8');
    expect(parseHexColor('#fff')).toBe('#ffffff');
    expect(parseHexColor('not-a-color')).toBe('');
  });

  it('converts hex colors into rgb channels for CSS variables', () => {
    expect(hexToRgbChannels('#9b6835')).toBe('155 104 53');
    expect(hexToRgbChannels('#fff')).toBe('255 255 255');
  });

  it('builds a full palette from a custom hex color', () => {
    const theme = buildPaletteFromHex('#2563eb');
    expect(theme.id).toBe(CUSTOM_COLOR_THEME_ID);
    expect(theme.sourceHex).toBe('#2563eb');
    expect(theme.colors.primary.DEFAULT).toMatch(/^#[0-9a-f]{6}$/);
    expect(theme.colors.primary[50]).toMatch(/^#[0-9a-f]{6}$/);
    expect(theme.colors.mist).toMatch(/^#[0-9a-f]{6}$/);
    expect(ensureReadablePrimary('#ffffff')).not.toBe('#ffffff');
  });

  it('applies CSS variables and the theme-color meta tag', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.append(meta);

    const theme = applyColorTheme('ruby');

    expect(document.documentElement.getAttribute('data-theme')).toBe('ruby');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('190 18 60');
    expect(document.documentElement.style.getPropertyValue('--color-primary-hex')).toBe('#be123c');
    expect(document.documentElement.style.getPropertyValue('--color-ink')).toBe('17 24 39');
    expect(document.documentElement.style.getPropertyValue('--color-secondary-600')).toBe('75 85 99');
    expect(meta.getAttribute('content')).toBe(theme.swatch);
  });

  it('applies a custom hex palette', () => {
    const theme = applyColorTheme('custom', '#2563eb');
    expect(theme.id).toBe(CUSTOM_COLOR_THEME_ID);
    expect(document.documentElement.getAttribute('data-theme')).toBe('custom');
    expect(document.documentElement.style.getPropertyValue('--color-primary-hex')).toBe(theme.swatch);
  });
});
