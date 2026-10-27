import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Refetch an open hospitality screen on SSE events, or poll every 5s when
 * live updates are off (e.g. cPanel). Callers supply `refetch` and only mount
 * this when the restaurant/hotel feature is actually enabled.
 */
export function useLiveScreenRefresh({
  enabled = true,
  eventNames = [],
  refetch,
  pollMs = 5000,
  pollWhenEventsDisabled = true,
} = {}) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const [eventsEnabled, setEventsEnabled] = useState(null);

  useEffect(() => {
    if (!enabled || !pollWhenEventsDisabled) return undefined;
    let cancelled = false;
    api
      .getEventsStatus()
      .then((status) => {
        if (!cancelled) setEventsEnabled(status?.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setEventsEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, pollWhenEventsDisabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (eventsEnabled !== false) return undefined;
    const timer = setInterval(() => {
      refetchRef.current?.();
    }, pollMs);
    return () => clearInterval(timer);
  }, [enabled, eventsEnabled, pollMs]);

  const names = Array.isArray(eventNames) ? eventNames.filter(Boolean) : [];
  const key = names.join('|');

  useEffect(() => {
    if (!enabled || !key) return undefined;
    const list = key.split('|').filter(Boolean);
    const listener = () => {
      refetchRef.current?.();
    };
    list.forEach((name) => window.addEventListener(name, listener));
    return () => {
      list.forEach((name) => window.removeEventListener(name, listener));
    };
  }, [enabled, key]);

  return { eventsEnabled };
}
