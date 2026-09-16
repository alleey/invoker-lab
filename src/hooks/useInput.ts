import { useEffect } from 'react';
import { ACTIONS, mouseCode, RESERVED_CODES, type Action } from '../engine/bindings';
import { useStore } from '../store';

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

function isControl(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SELECT');
}

/**
 * Owns every key and mouse button the drill responds to.
 *
 * Two distinct jobs, hence the branch: while a rebind is armed the next input is
 * swallowed and becomes the new binding; otherwise input is dispatched through
 * the binding table.
 */
export function useInput(): void {
  const bindings = useStore((s) => s.bindings);
  const capturing = useStore((s) => s.capturing);

  useEffect(() => {
    if (capturing !== null) {
      const onKeyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const store = useStore.getState();
        if (e.code === 'Escape') {
          store.cancelCapture();
          return;
        }
        if (RESERVED_CODES.includes(e.code)) return;
        store.commitCapture(e.code);
      };
      const onMouseDown = (e: MouseEvent) => {
        const code = mouseCode(e.button);
        if (!code) return;
        e.preventDefault();
        e.stopPropagation();
        useStore.getState().commitCapture(code);
      };
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('mousedown', onMouseDown, true);
      return () => {
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('mousedown', onMouseDown, true);
      };
    }

    const byCode = new Map<string, Action>();
    for (const action of ACTIONS) byCode.set(bindings[action], action);

    const perform = (action: Action) => {
      const store = useStore.getState();
      store.markFlash(action);
      switch (action) {
        case 'quas':
        case 'wex':
        case 'exort':
          store.castOrb(action);
          break;
        case 'invoke':
          store.invoke();
          break;
        case 'slot1':
          store.castSlot(0);
          break;
        case 'slot2':
          store.castSlot(1);
          break;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Key repeat would machine-gun orbs off a held key.
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const action = byCode.get(e.code);
      if (action) {
        // Also stops Space/Enter from re-activating a focused button.
        e.preventDefault();
        perform(action);
        return;
      }

      if (isControl(e.target)) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        useStore.getState().toggleRun();
      } else if (e.code === 'Escape') {
        useStore.getState().clearOrbs();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const code = mouseCode(e.button);
      if (!code) return;
      const action = byCode.get(code);
      if (!action) return;
      e.preventDefault();
      perform(action);
    };

    // Back/forward buttons navigate unless the aux click is swallowed too.
    const swallowAux = (e: MouseEvent) => {
      const code = mouseCode(e.button);
      if (code && byCode.has(code)) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('auxclick', swallowAux);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('auxclick', swallowAux);
    };
  }, [bindings, capturing]);
}
