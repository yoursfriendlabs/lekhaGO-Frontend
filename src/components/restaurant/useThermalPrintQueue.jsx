import { useCallback, useEffect, useRef, useState } from 'react';
import KotTicket from '@/components/print/KotTicket';
import BillCheck from '@/components/print/BillCheck';
import { printThermalReceipt } from '@/lib/print/print';

/**
 * Sequential thermal printing for KOT tickets and bill checks.
 * Jobs: { type: 'kot' | 'check', props }.
 * Render `printHost` once somewhere in the page tree.
 */
export function useThermalPrintQueue() {
  const [queue, setQueue] = useState([]);
  const sourceRef = useRef(null);

  const enqueuePrint = useCallback((jobs) => {
    const list = (Array.isArray(jobs) ? jobs : [jobs]).filter(Boolean);
    if (list.length === 0) return;
    setQueue((previous) => [...previous, ...list]);
  }, []);

  const current = queue[0] || null;

  useEffect(() => {
    if (!current) return undefined;
    const frame = window.requestAnimationFrame(async () => {
      try {
        if (sourceRef.current) await printThermalReceipt(sourceRef.current);
      } catch {
        // Printing is best-effort; the order flow must never break on it.
      } finally {
        setQueue((previous) => previous.slice(1));
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current]);

  const printHost = (
    <div className="hidden" aria-hidden="true">
      {current ? (
        <div ref={sourceRef}>
          {current.type === 'check' ? <BillCheck {...current.props} /> : <KotTicket {...current.props} />}
        </div>
      ) : null}
    </div>
  );

  return { enqueuePrint, printHost, printing: queue.length > 0 };
}

export default useThermalPrintQueue;
