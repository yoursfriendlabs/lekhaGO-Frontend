import { useEffect, useId, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';
import { useTheme } from '../lib/theme';
import { CUSTOM_COLOR_THEME_ID, parseHexColor } from '../lib/themes';

export default function ThemeSelector({ variant = 'cards' }) {
  const { t } = useI18n();
  const { themeId, setThemeId, setCustomColor, themes, customHex, colorTheme } = useTheme();
  const headingId = useId();

  if (variant === 'compact') {
    return (
      <CompactThemeSelector
        themes={themes}
        themeId={themeId}
        setThemeId={setThemeId}
        setCustomColor={setCustomColor}
        customHex={customHex}
        colorTheme={colorTheme}
        t={t}
      />
    );
  }

  const customSelected = themeId === CUSTOM_COLOR_THEME_ID;

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-labelledby={headingId}>
        <div>
          <p id={headingId} className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-500">
            {t('theme.pickerLabel')}
          </p>
          <p className="page-subtitle">{t('theme.subtitle')}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {themes.map((theme) => {
            const selected = theme.id === themeId;

            return (
              <button
                key={theme.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setThemeId(theme.id)}
                className={`rounded-3xl border p-4 text-left transition ${
                  selected
                    ? 'border-primary bg-primary/10 shadow-soft ring-2 ring-primary/20'
                    : 'border-secondary-200 bg-surface hover:border-primary/40 hover:bg-primary/5'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span
                    className="h-10 w-10 rounded-2xl border border-black/5 shadow-sm"
                    style={{ backgroundColor: theme.swatch }}
                    aria-hidden
                  />
                  {selected ? (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
                      <Check size={14} aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span className="mt-4 block text-sm font-semibold text-ink">{t(theme.labelKey)}</span>
                <span className="mt-1 block text-xs leading-5 text-secondary-600">{t(theme.hintKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <CustomHexField
        t={t}
        customHex={customHex}
        colorTheme={colorTheme}
        selected={customSelected}
        setCustomColor={setCustomColor}
      />
    </div>
  );
}

function CustomHexField({ t, customHex, colorTheme, selected, setCustomColor, compact = false }) {
  const [value, setValue] = useState(customHex || colorTheme?.sourceHex || colorTheme?.swatch || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setValue(customHex || colorTheme?.sourceHex || colorTheme?.swatch || '');
  }, [colorTheme?.sourceHex, colorTheme?.swatch, customHex]);

  const applyValue = (nextValue) => {
    const parsed = parseHexColor(nextValue);
    if (!parsed) {
      setError(t('theme.customHexInvalid'));
      return false;
    }
    setError('');
    setValue(parsed);
    return setCustomColor(parsed);
  };

  const pickerValue = parseHexColor(value) || colorTheme?.swatch || '#9b6835';

  return (
    <form
      className={compact ? 'mt-3 space-y-2' : 'rounded-3xl border border-secondary-200 bg-surface p-4'}
      onSubmit={(event) => {
        event.preventDefault();
        applyValue(value);
      }}
    >
      <div className={compact ? '' : 'mb-3'}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-500">
          {t('theme.customHexLabel')}
        </p>
        {compact ? null : <p className="mt-1 text-sm text-secondary-600">{t('theme.customHexHint')}</p>}
      </div>

      <div className="flex items-center gap-2">
        <label className="relative shrink-0">
          <span className="sr-only">{t('theme.customHexLabel')}</span>
          <span
            className={`block h-10 w-10 rounded-2xl border shadow-sm ${
              selected ? 'border-ink ring-2 ring-primary/30' : 'border-secondary-200'
            }`}
            style={{ backgroundColor: pickerValue }}
            aria-hidden
          />
          <input
            type="color"
            value={pickerValue}
            onChange={(event) => applyValue(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        <input
          type="text"
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={t('theme.customHexPlaceholder')}
          aria-invalid={Boolean(error)}
          aria-label={t('theme.customHexLabel')}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError('');
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (parseHexColor(pasted)) {
              event.preventDefault();
              applyValue(pasted);
            }
          }}
          className={`input min-w-0 flex-1 font-mono text-sm ${compact ? 'h-10 py-2' : ''}`}
        />

        <button type="submit" className="btn-primary h-10 shrink-0 px-3 text-xs">
          {t('theme.customHexApply')}
        </button>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </form>
  );
}

function CompactThemeSelector({ themes, themeId, setThemeId, setCustomColor, customHex, colorTheme, t }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const customSelected = themeId === CUSTOM_COLOR_THEME_ID;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-2xl border border-secondary-200 bg-surface px-3 py-2 text-primary transition-transform active:scale-95"
        aria-label={t('theme.pickerLabel')}
        title={t('theme.pickerLabel')}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <Palette className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-secondary-200 bg-surface p-3 shadow-soft">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-500">
            {t('theme.pickerLabel')}
          </p>
          <div className="flex flex-wrap gap-2" role="listbox" aria-label={t('theme.pickerLabel')}>
            {themes.map((theme) => {
              const selected = theme.id === themeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={t(theme.labelKey)}
                  aria-label={t(theme.labelKey)}
                  onClick={() => setThemeId(theme.id)}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    selected ? 'border-ink ring-2 ring-primary/30' : 'border-white shadow-sm hover:scale-105'
                  }`}
                  style={{ backgroundColor: theme.swatch }}
                />
              );
            })}
            {customHex ? (
              <button
                type="button"
                role="option"
                aria-selected={customSelected}
                title={t('theme.names.custom')}
                aria-label={t('theme.names.custom')}
                onClick={() => setCustomColor(customHex)}
                className={`h-8 w-8 rounded-full border-2 transition ${
                  customSelected ? 'border-ink ring-2 ring-primary/30' : 'border-white shadow-sm hover:scale-105'
                }`}
                style={{ backgroundColor: colorTheme?.swatch || customHex }}
              />
            ) : null}
          </div>
          <CustomHexField
            compact
            t={t}
            customHex={customHex}
            colorTheme={colorTheme}
            selected={customSelected}
            setCustomColor={setCustomColor}
          />
        </div>
      ) : null}
    </div>
  );
}
