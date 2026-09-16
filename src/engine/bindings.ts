/**
 * Bindings are stored as PHYSICAL key codes (`KeyboardEvent.code`), never as
 * characters. That is what Dota does, and it means a bind survives a layout
 * switch: `KeyE` is the third key of the top row whether the cap says E, D or Д.
 *
 * Mouse buttons ride the same namespace as `Mouse3`/`Mouse4`/`Mouse5`.
 */
import { ALL_ORBS, ORB_INFO, type Orb } from './spells';

export type Action = 'quas' | 'wex' | 'exort' | 'invoke' | 'slot1' | 'slot2';

export const ACTIONS: readonly Action[] = ['quas', 'wex', 'exort', 'invoke', 'slot1', 'slot2'];

export const ACTION_LABEL: Record<Action, string> = {
  quas: 'Quas',
  wex: 'Wex',
  exort: 'Exort',
  invoke: 'Invoke',
  slot1: 'Slot 1',
  slot2: 'Slot 2',
};

/** What an action is drawn in: its reagent, gold for invoke, bone for a slot. */
export const ACTION_HEX: Record<Action, string> = {
  quas: ORB_INFO.quas.hex,
  wex: ORB_INFO.wex.hex,
  exort: ORB_INFO.exort.hex,
  invoke: '#ffd76a',
  slot1: '#ebe1cc',
  slot2: '#ebe1cc',
};

export const isOrbAction = (a: Action): a is Orb => a === 'quas' || a === 'wex' || a === 'exort';

export type Bindings = Record<Action, string>;

export interface Preset {
  id: string;
  label: string;
  hint: string;
  bindings: Bindings;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'ert',
    label: 'E R T · W',
    hint: 'Orbs on three adjacent keys, invoke under the index finger',
    bindings: { quas: 'KeyE', wex: 'KeyR', exort: 'KeyT', invoke: 'KeyW', slot1: 'KeyD', slot2: 'KeyF' },
  },
  {
    id: 'default',
    label: 'Q W E · R',
    hint: "Dota's out-of-the-box Invoker layout",
    bindings: { quas: 'KeyQ', wex: 'KeyW', exort: 'KeyE', invoke: 'KeyR', slot1: 'KeyD', slot2: 'KeyF' },
  },
  {
    id: 'qwe-space',
    label: 'Q W E · Space',
    hint: 'Invoke on the thumb, slots on the mouse',
    bindings: { quas: 'KeyQ', wex: 'KeyW', exort: 'KeyE', invoke: 'Space', slot1: 'Mouse4', slot2: 'Mouse5' },
  },
];

export const DEFAULT_PRESET_ID = 'ert';

export function presetBindings(id: string): Bindings {
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0];
  return { ...(preset as Preset).bindings };
}

/** Keys the app keeps for itself, so a capture can always be escaped. */
export const RESERVED_CODES: readonly string[] = ['Escape', 'Tab', 'F5', 'F11', 'F12'];

/**
 * Rebinding swaps rather than rejects: if the incoming code already belongs to
 * another action, that action inherits the code being replaced. Nothing is ever
 * left unbound, so you can never trap yourself with a half-configured layout.
 */
export function rebind(bindings: Bindings, action: Action, code: string): Bindings {
  const next: Bindings = { ...bindings };
  const clash = ACTIONS.find((a) => a !== action && next[a] === code);
  if (clash) next[clash] = next[action];
  next[action] = code;
  return next;
}

export function matchesPreset(bindings: Bindings): string | null {
  const hit = PRESETS.find((p) => ACTIONS.every((a) => p.bindings[a] === bindings[a]));
  return hit ? hit.id : null;
}

/** `MouseEvent.button` → our code, for the three buttons safe to steal. */
export function mouseCode(button: number): string | null {
  if (button === 1) return 'Mouse3';
  if (button === 3) return 'Mouse4';
  if (button === 4) return 'Mouse5';
  return null; // left and right stay with the UI
}

const SPECIAL_LABEL: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', CapsLock: 'Caps',
  ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  AltLeft: 'L Alt', AltRight: 'R Alt', Mouse3: 'M3', Mouse4: 'M4', Mouse5: 'M5',
};

let layoutMap: Map<string, string> | null = null;

/**
 * Chromium exposes the real cap legend for a physical code. Where it exists a
 * Dvorak or AZERTY user sees their own letters; elsewhere we fall back to the
 * US-ish label baked into the code name.
 */
export async function loadKeyboardLayout(): Promise<void> {
  try {
    const kb = (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
    if (kb?.getLayoutMap) layoutMap = await kb.getLayoutMap();
  } catch {
    layoutMap = null;
  }
}

/**
 * A spell's reagents written as the keys THIS player actually presses — "EEE"
 * for Cold Snap on an E-R-T layout, not the canonical "QQQ". Sorted into
 * Quas/Wex/Exort order so it reads the same every time.
 *
 * Multi-character labels (Space, M4) are spaced out, since "M4M4M4" is a puzzle.
 */
export function keySequence(orbs: readonly Orb[], bindings: Bindings): string {
  const ordered = ALL_ORBS.flatMap((orb) => orbs.filter((each) => each === orb));
  const labels = ordered.map((orb) => keyLabel(bindings[orb]));
  return labels.join(labels.every((label) => label.length === 1) ? '' : ' ');
}

export function keyLabel(code: string): string {
  const fromLayout = layoutMap?.get(code);
  if (fromLayout) return fromLayout.toUpperCase();
  const special = SPECIAL_LABEL[code];
  if (special) return special;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code.startsWith('Arrow')) return code.slice(5);
  return code;
}
