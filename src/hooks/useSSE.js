import { useEffect, useRef } from 'react';
import { API_BASE, api, invalidateApiCache } from '../lib/api';
import { getToken, getBusinessId } from '../lib/storage';

/**
 * Custom event names dispatched on `window` when SSE events arrive.
 * Components can listen via `window.addEventListener(...)` or the
 * `useSSEEvent` helper below.
 */
export const SSE_EVENTS = {
  SALES_CHANGED: 'mms:sse:sales-changed',
  TASKS_CHANGED: 'mms:sse:tasks-changed',
  TABLES_CHANGED: 'mms:sse:tables-changed',
  CONNECTED: 'mms:sse:connected',
};

/**
 * Map of server-side SSE event names → client-side window event names
 * and the cache tags they should invalidate.
 */
const EVENT_MAP = {
  'sales-changed': {
    windowEvent: SSE_EVENTS.SALES_CHANGED,
    invalidateTags: ['sales', 'dashboard'],
  },
  'tasks-changed': {
    windowEvent: SSE_EVENTS.TASKS_CHANGED,
    invalidateTags: ['tasks', 'task-notifications', 'dashboard'],
  },
  'tables-changed': {
    windowEvent: SSE_EVENTS.TABLES_CHANGED,
    invalidateTags: ['tables'],
  },
};

/** Maximum reconnect delay (30 seconds). */
const MAX_RECONNECT_DELAY_MS = 30_000;
/** Initial reconnect delay. */
const INITIAL_RECONNECT_DELAY_MS = 1_000;
/**
 * Consecutive failures with no successful handshake before we stop retrying.
 * Without this, a server that declines the stream (disabled, or at its
 * per-business cap) would be re-dialled by every open tab forever. Reaching
 * this limit is not degraded behaviour: the app polls for updates anyway.
 */
const MAX_CONSECUTIVE_FAILURES = 4;

/**
 * Hook that establishes a persistent SSE connection to the backend.
 * When events arrive, it:
 *   1. Invalidates relevant API cache tags (so next fetch hits network)
 *   2. Dispatches a window CustomEvent for any component to react to
 *
 * Place this once in a top-level layout/provider component.
 */
export function useSSE({ enabled = true } = {}) {
  const esRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const failureCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;

    const token = getToken();
    const businessId = getBusinessId();
    if (!token || !businessId) return undefined;

    let destroyed = false;

    function connect() {
      if (destroyed) return;

      // Clean up any previous connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      // EventSource doesn't support custom headers, so we pass auth
      // via query params. The server-side auth middleware already reads
      // from cookies as well, but this ensures it works in all contexts.
      const url = `${API_BASE}/api/events/stream?token=${encodeURIComponent(token)}&businessId=${encodeURIComponent(businessId)}`;

      const es = new EventSource(url);
      esRef.current = es;

      // Register handlers for each known event type
      Object.entries(EVENT_MAP).forEach(([sseEvent, config]) => {
        es.addEventListener(sseEvent, (event) => {
          let data = {};
          try {
            data = JSON.parse(event.data);
          } catch (_e) {
            // Ignore parse errors
          }

          // 1. Invalidate cached API responses
          invalidateApiCache(config.invalidateTags);

          // 2. Dispatch a window event so components can react
          window.dispatchEvent(
            new CustomEvent(config.windowEvent, { detail: data }),
          );
        });
      });

      es.addEventListener('connected', () => {
        // A completed handshake clears both backoff and the give-up counter,
        // so periodic server-side connection recycling stays invisible here.
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
        failureCountRef.current = 0;
        window.dispatchEvent(
          new CustomEvent(SSE_EVENTS.CONNECTED, { detail: { businessId } }),
        );
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (destroyed) return;

        failureCountRef.current += 1;
        if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) return;

        // Exponential backoff reconnect
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          delay * 2,
          MAX_RECONNECT_DELAY_MS,
        );

        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    // Ask first: opening a stream the server has switched off would burn the
    // retry budget before we learned anything.
    api
      .getEventsStatus()
      .then((status) => {
        if (!destroyed && status?.enabled) connect();
      })
      .catch(() => {
        // Status is only an optimisation; fall back to trying the stream.
        if (!destroyed) connect();
      });

    return () => {
      destroyed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [enabled]);
}

/**
 * Hook to subscribe to a specific SSE-driven window event.
 * @param {string} eventName — one of the SSE_EVENTS constants
 * @param {(detail: object) => void} handler
 */
export function useSSEEvent(eventName, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!eventName) return;

    const listener = (event) => {
      handlerRef.current(event.detail || {});
    };

    window.addEventListener(eventName, listener);
    return () => window.removeEventListener(eventName, listener);
  }, [eventName]);
}
