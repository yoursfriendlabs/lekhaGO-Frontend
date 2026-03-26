import { useRef } from 'react';
import { normalizeOtpDigits } from '../../lib/authFlow';

export default function OtpInput({
  digits,
  onChange,
  disabled = false,
  ariaLabelPrefix = 'OTP digit',
}) {
  const inputRefs = useRef([]);
  const otpLength = digits.length;

  const focusIndex = (index) => {
    const target = inputRefs.current[index];
    if (!target) return;
    target.focus();
    target.select();
  };

  const applyDigits = (startIndex, rawValue) => {
    const clean = normalizeOtpDigits(rawValue);
    if (!clean) return;

    const nextDigits = [...digits];
    clean
      .slice(0, otpLength - startIndex)
      .split('')
      .forEach((digit, offset) => {
        nextDigits[startIndex + offset] = digit;
      });

    onChange(nextDigits);

    const nextFocusIndex = Math.min(startIndex + clean.length, otpLength - 1);
    window.requestAnimationFrame(() => focusIndex(nextFocusIndex));
  };

  const handleChange = (index, value) => {
    if (!value) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      onChange(nextDigits);
      return;
    }

    applyDigits(index, value);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        onChange(nextDigits);
        return;
      }

      if (index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        onChange(nextDigits);
        window.requestAnimationFrame(() => focusIndex(index - 1));
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (event.key === 'ArrowRight' && index < otpLength - 1) {
      event.preventDefault();
      focusIndex(index + 1);
    }
  };

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          className="h-14 rounded-2xl border border-slate-200 bg-white px-0 text-center text-3xl font-semibold leading-none text-slate-900 shadow-sm outline-none transition [font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation_Mono,Courier_New,monospace] [font-variant-numeric:lining-nums_tabular-nums] focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          inputMode="numeric"
          pattern="[0-9]*"
          lang="en"
          dir="ltr"
          spellCheck={false}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={otpLength}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => {
            event.preventDefault();
            applyDigits(index, event.clipboardData.getData('text'));
          }}
          disabled={disabled}
          aria-label={`${ariaLabelPrefix} ${index + 1}`}
        />
      ))}
    </div>
  );
}
