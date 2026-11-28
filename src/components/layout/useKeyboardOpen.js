import { useEffect, useState } from 'react';

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

function isTextField(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element.tagName === 'TEXTAREA') return true;
  if (element.tagName === 'SELECT') return false;
  if (element.tagName !== 'INPUT') return false;
  return !NON_TEXT_INPUTS.has(String(element.getAttribute('type') || 'text').toLowerCase());
}

/**
 * True on touch phones while a text field has focus, so the bottom tab bar
 * can step aside instead of riding on top of the on-screen keyboard.
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const coarse = window.matchMedia?.('(pointer: coarse)');
    if (!coarse?.matches) return undefined;

    let blurTimer = null;
    const handleFocusIn = (event) => {
      window.clearTimeout(blurTimer);
      setOpen(isTextField(event.target));
    };
    const handleFocusOut = () => {
      // Focus often hops between two fields; wait a moment before showing the bar.
      blurTimer = window.setTimeout(() => setOpen(isTextField(document.activeElement)), 120);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      window.clearTimeout(blurTimer);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return open;
}
