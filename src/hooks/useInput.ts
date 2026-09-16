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
      const store = useStore.getState();

      // F9 works from anywhere, including from inside a hold — it is the way out.
      if (e.code === 'F9') {
        e.preventDefault();
        store.togglePause();
        return;
      }

      /* A held board takes no input but the two keys that release it. The guard
         sits here so every branch below — orbs, casts, Space, Escape — is
         covered once rather than each remembering to check. */
      if (store.paused) {
        if (e.code === 'Escape') {
          e.preventDefault();
          store.togglePause();
        }
        return;
      }

      const onPage = store.kbOpen || store.statsOpen || store.masteryOpen;

      // Escape unwinds one layer at a time, innermost first.
      if (e.code === 'Escape') {
        e.preventDefault();
        if (onPage) store.setPage(null);
        else if (store.result) store.dismissResult();
        else if (store.practicing) store.setPracticing(false);
        else store.clearOrbs();
        return;
      }

      /* The board only answers to you once you have committed to something.
         An idle mode used to be playable, which made every unstarted mode a
         second sandbox and left the Begin button looking optional. */
      const live = store.running || store.practicing;
      const action = byCode.get(e.code);
      if (action) {
        // Also stops Space/Enter from re-activating a focused button.
        e.preventDefault();
        if (live && !onPage) perform(action);
        return;
      }

      if (onPage || isControl(e.target)) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        // The results view is a finished run, so Space runs the next one rather
        // than toggling a drill that has already ended.
        if (store.result) store.start();
        else store.toggleRun();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const code = mouseCode(e.button);
      if (!code) return;
      const action = byCode.get(code);
      if (!action) return;
      e.preventDefault();
      const store = useStore.getState();
      if (store.paused || store.kbOpen || store.statsOpen || store.masteryOpen) return;
      if (!store.running && !store.practicing) return;
      perform(action);
    };

    // Back/forward buttons navigate unless the aux click is swallowed too.
    const swallowAux = (e: MouseEvent) => {
      const code = mouseCode(e.button);
      if (code && byCode.has(code)) e.preventDefault();
    };

    const swallowContext = (e: MouseEvent) => {
      if (byCode.has('Mouse3')) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('auxclick', swallowAux);
    window.addEventListener('contextmenu', swallowContext);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('auxclick', swallowAux);
      window.removeEventListener('contextmenu', swallowContext);
    };
  }, [bindings, capturing]);
}
