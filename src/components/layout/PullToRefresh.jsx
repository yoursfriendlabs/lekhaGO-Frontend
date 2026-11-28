import { useEffect, useRef, useState } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { isStandaloneMode } from '@/lib/pwa.js';

const TRIGGER_DISTANCE = 72;
const MAX_PULL = 120;
const MIN_SPIN_MS = 600;

function canStartPull(target) {
  if (window.scrollY > 0) return false;
  if (document.body.classList.contains('sheet-open')) return false;
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    if (node.closest?.('[role="dialog"], [data-no-pull-refresh]')) return false;
    const style = window.getComputedStyle(node);
    if (style.position === 'fixed') return false;
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollTop > 0) return false;
    node = node.parentElement;
  }
  return true;
}

/**
 * Pull down at the top of a screen to reload its data. Installed apps have no
 * browser reload button, so this is the only way to refresh by hand there.
 * Turned on only on touch phones running as an installed app; browsers
 * already have their own pull-to-refresh.
 */
export default function PullToRefresh({ onRefresh }) {
  const { t } = useI18n();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startRef = useRef(null);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const enabled = isStandaloneMode()
      && window.matchMedia?.('(pointer: coarse)').matches
      && window.matchMedia?.('(max-width: 1023px)').matches;
    if (!enabled) return undefined;

    const setPull = (value) => {
      distanceRef.current = value;
      setDistance(value);
    };

    const handleStart = (event) => {
      if (refreshingRef.current || event.touches.length !== 1) return;
      startRef.current = canStartPull(event.target)
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : null;
    };

    const handleMove = (event) => {
      if (!startRef.current) return;
      const dy = event.touches[0].clientY - startRef.current.y;
      const dx = Math.abs(event.touches[0].clientX - startRef.current.x);
      if (dy <= 0 || dx > dy || window.scrollY > 0) {
        if (distanceRef.current) setPull(0);
        if (dy < 0 || dx > dy) startRef.current = null;
        return;
      }
      // Resistance: the further you pull, the slower it follows.
      setPull(Math.min(MAX_PULL, dy * 0.5));
      if (event.cancelable) event.preventDefault();
    };

    const handleEnd = async () => {
      if (!startRef.current) return;
      startRef.current = null;
      if (distanceRef.current < TRIGGER_DISTANCE) {
        setPull(0);
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      setPull(TRIGGER_DISTANCE * 0.75);
      const startedAt = Date.now();
      try {
        await onRefreshRef.current?.();
      } finally {
        const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt));
        window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          setPull(0);
        }, wait);
      }
    };

    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, []);

  const visible = distance > 4 || refreshing;
  const ready = distance >= TRIGGER_DISTANCE;
  const label = refreshing ? t('pwa.refreshing') : ready ? t('pwa.releaseToRefresh') : t('pwa.pullToRefresh');

  return (
    <div
      className="ptr-indicator pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-30 flex justify-center md:hidden"
      data-pulling={distance > 0 && !refreshing ? 'true' : 'false'}
      style={{ transform: `translateY(${visible ? distance : -48}px)`, opacity: visible ? 1 : 0 }}
      aria-live="polite"
    >
      <div className="mt-2 flex items-center gap-2 rounded-full border border-secondary-200 bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-lg">
        {refreshing ? (
          <RefreshCw className="h-4 w-4 animate-spin text-primary-600" aria-hidden />
        ) : (
          <ArrowDown
            className="h-4 w-4 text-primary-600 transition-transform"
            style={{ transform: `rotate(${ready ? 180 : 0}deg)` }}
            aria-hidden
          />
        )}
        {visible ? <span>{label}</span> : null}
      </div>
    </div>
  );
}
