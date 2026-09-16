import { useEffect, useState } from 'react';
import type { Action } from '../engine/bindings';
import { useStore } from '../store';

/**
 * The action whose key was pressed a moment ago, for press feedback.
 *
 * Shared so the keycaps and the slot plates light up identically — they are two
 * views of the same control surface.
 */
export function useHotAction(ms = 120): Action | null {
  const flash = useStore((s) => s.flash);
  const [hot, setHot] = useState<Action | null>(null);

  useEffect(() => {
    if (!flash) return;
    setHot(flash.action);
    const timer = window.setTimeout(() => setHot(null), ms);
    return () => window.clearTimeout(timer);
  }, [flash, ms]);

  return hot;
}
