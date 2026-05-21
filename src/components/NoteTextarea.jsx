import { forwardRef, useMemo } from 'react';
import { useI18n } from '../lib/i18n.jsx';

const DEFAULT_MAX_WORDS = 1000;

export function countWords(value = '') {
  const words = String(value || '').match(/\S+/g);
  return words ? words.length : 0;
}

export function limitWords(value = '', maxWords = DEFAULT_MAX_WORDS) {
  const text = String(value || '');
  if (countWords(text) <= maxWords) return text;

  let seen = 0;
  let cutoff = text.length;

  for (const match of text.matchAll(/\S+/g)) {
    seen += 1;
    if (seen === maxWords) {
      cutoff = match.index + match[0].length;
      break;
    }
  }

  return text.slice(0, cutoff);
}

const NoteTextarea = forwardRef(function NoteTextarea(
  {
    value = '',
    onChange,
    onValueChange,
    maxWords = DEFAULT_MAX_WORDS,
    className = '',
    wrapperClassName = '',
    counterClassName = '',
    ...props
  },
  ref
) {
  const { t } = useI18n();
  const textValue = String(value || '');
  const wordCount = useMemo(() => countWords(textValue), [textValue]);
  const isAtLimit = wordCount >= maxWords;

  const handleChange = (event) => {
    const nextValue = limitWords(event.target.value, maxWords);

    if (onValueChange) {
      onValueChange(nextValue, event);
    }

    if (!onChange) return;

    if (nextValue === event.target.value) {
      onChange(event);
      return;
    }

    onChange({
      ...event,
      target: {
        ...event.target,
        name: event.target.name,
        type: event.target.type,
        checked: event.target.checked,
        value: nextValue,
      },
      currentTarget: {
        ...event.currentTarget,
        name: event.currentTarget.name,
        type: event.currentTarget.type,
        checked: event.currentTarget.checked,
        value: nextValue,
      },
    });
  };

  return (
    <div className={`relative ${wrapperClassName}`}>
      <textarea
        ref={ref}
        {...props}
        className={`${className} pb-8`}
        value={textValue}
        onChange={handleChange}
      />
      <span
        className={`pointer-events-none absolute bottom-2 right-3 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold shadow-sm ring-1 ring-slate-200/70 ${
          isAtLimit ? 'text-amber-600' : 'text-slate-400'
        } ${counterClassName}`}
      >
        {wordCount}/{maxWords} {t('common.words')}
      </span>
    </div>
  );
});

export default NoteTextarea;
