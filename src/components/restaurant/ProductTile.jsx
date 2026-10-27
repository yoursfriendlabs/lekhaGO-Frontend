import { useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { formatMoney } from '@/lib/restaurant/model';

const LONG_PRESS_MS = 500;

function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

/**
 * Menu tile. Tap = quick add; long-press (or the options button) = note/extras.
 */
export default function ProductTile({ product, onQuickAdd, onOptions, disabled = false, optionsLabel = 'Options' }) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    if (disabled) return;
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      timerRef.current = null;
      onOptions?.(product);
    }, LONG_PRESS_MS);
  };

  const handleClick = () => {
    if (disabled) return;
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    onQuickAdd?.(product);
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(event) => event.preventDefault()}
        onClick={handleClick}
        className="card flex h-full w-full flex-col overflow-hidden p-0 text-left transition active:scale-[0.98] enabled:hover:border-primary/40 disabled:opacity-60"
        style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
      >
        <div className="flex h-24 w-full items-center justify-center bg-secondary-100 sm:h-28">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt=""
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-secondary-400">{initials(product.name)}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-between gap-1 p-2.5">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{product.name}</p>
          <p className="text-sm font-bold text-primary">{formatMoney(product.price)}</p>
        </div>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOptions?.(product)}
        className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-secondary-600 shadow hover:bg-white"
        aria-label={optionsLabel}
        title={optionsLabel}
      >
        <SlidersHorizontal size={14} />
      </button>
    </div>
  );
}
